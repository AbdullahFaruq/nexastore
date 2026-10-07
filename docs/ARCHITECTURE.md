# Architecture

Why NexaStore is put together the way it is. Each section states a decision and
the alternative it was chosen over.

---

## 1. Money is an integer, always

Every monetary field in MongoDB is an integer in the currency's minor unit.
`$249.00` is stored as `24900`. JPY, which has no minor unit, stores `1234` for
1,234 yen.

**Why not a float?** Because `0.1 + 0.2 !== 0.3`, and a shop that rings up
40,000 transactions a year will accumulate visible drift in its annual total.
Integers make every sum exact.

**Why not `Decimal128`?** It is correct, but every read needs conversion, the
driver returns a wrapper type that leaks into every interface, and aggregation
expressions become noticeably more awkward. Integer minor units get the same
exactness with plain numbers.

Conversion happens only at the display boundary, inside
`src/lib/format/currency.ts`. Nothing else in the codebase divides by 100.

`allocate()` in the same file distributes an order-level discount across lines
using the largest-remainder method, so the parts always sum to exactly the
whole - a naive proportional split loses or invents a cent.

---

## 2. The pricing engine is one pure function

`computeSaleTotals()` in `src/lib/sales/pricing.ts` is the only place a sale
total is calculated. It is pure, has no database dependency, and is used by:

- the server action that records a sale,
- the POS terminal, for the live preview as items are scanned,
- the demo seeder, so seeded data is arithmetically identical to real data.

The browser never sends prices. It sends product ids, quantities and a discount;
the server looks up its own prices and derives everything. A tampered request
can change what is bought, never what it costs.

Order of operations, which matters:

1. Line gross = `unit price x quantity`
2. Subtract per-line discounts
3. Allocate the order-level discount across lines in proportion to their
   post-line-discount value
4. Compute tax **per line** on the result
5. Sum

Step 3 is what keeps per-line tax correct when an order-level discount is
applied - taxing the pre-discount amount would overcharge the customer.

Step 4 rounds per line, not on the header. This is what an invoice actually
shows, and it means the line amounts always add up to the total. It also means
the header tax can differ from a naive percentage of the header total by a unit
or two, which is correct rather than a bug.

---

## 3. Revenue excludes tax

Tax collected from a customer is money held for the tax authority. It is a
liability, not income. Counting it as revenue inflates the top line and
understates the margin.

So: `revenue = gross - discounts - refunds`, with tax tracked separately and
reported as a memo line on the P&L.

Two tax modes are supported. Under **exclusive** (the default) the entered price
is pre-tax and tax is added at the till. Under **inclusive** the entered price
already contains tax and the ex-tax base is backed out of it
(`base = amount * 10000 / (10000 + bps)`). Both modes agree on what the customer
pays; they differ in what counts as revenue.

---

## 4. Cost of goods is snapshotted at the moment of sale

`SaleItem.unitCost` is written when the sale happens and never re-read from the
product afterwards.

**Why?** If COGS were computed by joining to the product's current cost price,
then negotiating a better price with a supplier would retroactively change last
quarter's profit. Historical margin has to be stable.

The same reasoning applies to `productName`, `sku` and `categoryId` on
`SaleItem`: renaming a product must not rewrite an old invoice.

---

## 5. Sale, line items, stock and ledger are written together

Completing a sale touches four collections. `withTransaction()` wraps all four
so the set either lands completely or not at all.

Without it, a crash between "decrement stock" and "insert sale" leaves a shop
with stock missing and no order explaining where it went - an error nobody can
reconstruct later. This is the reason the app requires a replica set.

On a standalone `mongod` (development only, `MONGODB_TRANSACTIONS=off`) it
degrades to a sequential run, and the README says plainly not to do that in
production.

---

## 6. Sale carries denormalised totals; SaleItem is the line ledger

Both exist, deliberately.

- **`Sale`** holds the header totals. A revenue rollup over a date range is one
  indexed range scan on one collection, with no `$lookup`. This is the query the
  dashboard runs most.
- **`SaleItem`** is the line ledger, and the source of truth for product- and
  category-level analytics. It carries `soldAt`, `status` and `categoryId`
  copied down from its parent, so product performance is also a single indexed
  scan with no join.

They cannot drift because they are written in the same transaction by the same
function, and `check:analytics` asserts the two reconcile.

---

## 7. Tenant isolation is a Membership row, not a claim

`getStoreContext()` resolves the caller's tenant like this:

1. Read the authenticated user id from Clerk.
2. Read the user's `activeStoreId` from their profile.
3. **Re-validate it against a live `Membership` row.**

Step 3 is the control. A stale or tampered `activeStoreId` resolves to nothing.
`Store.ownerUserId` is a convenience field and is never used as an
authorisation check.

Every query then filters on `ctx.storeId`. A product id belonging to another
store simply does not resolve - there is no "found but forbidden" branch to get
wrong. `check:flows` asserts this by trying to sell another tenant's product.

---

## 8. Permissions are a matrix the server enforces

`src/lib/auth/permissions.ts` maps role to permissions. Both the sidebar and
every server action read the same map, so what is hidden and what is enforced
can never diverge.

The employee role deliberately lacks `analytics:view`. A till operator records
sales without seeing the store's margins. Hiding the panels is a courtesy; the
control is `requirePermission()` at the top of every mutating action.

---

## 9. Analytics are aggregation pipelines, never application loops

Every figure comes from a MongoDB aggregation. Nothing loads a collection into
Node to sum it.

Two details do a lot of work:

- **`$dateTrunc` with `timezone`.** "Today's revenue" for a shop in Istanbul
  means Istanbul's today. Bucketing in UTC would cut the day in the wrong place
  and split evening trade across two days.
- **Bucket enumeration.** A day with no sales must render as a zero, not vanish.
  `enumerateBuckets()` walks the full range so gaps are visible rather than
  silently closing up and flattering the trend.

Net-of-refund accumulators are defined once in `analytics/shared.ts` and reused
everywhere, so a refund is reversed identically in every rollup.

---

## 10. A period in progress compares against the same elapsed slice

This is the single most common way a dashboard lies.

On the 5th of the month, "this month" against "last month" compares five days
to thirty-one and reports a 60% collapse in a business that is doing fine.

`resolveRange()` detects a window that extends past now and trims the comparison
window to the same elapsed length: five days of August against the first five
days of July. The label says "vs last month to date" so the reader knows what
they are looking at.

The chart applies the same honesty in the other direction: the final bucket of
an in-progress period is shaded and footnoted, rather than plotted as if the day
were over.

---

## 11. Insights are computed, not generated

Each insight in `analytics/insights.ts` is a threshold, a comparison or a rate,
and each carries an `evidence` object holding the figures it was derived from.
Nothing is language-model output, and the UI says so.

Generators run through `Promise.allSettled`, so one failing generator drops a
single card rather than blanking the page.

The `evidence` shape is deliberately what an LLM layer would need as grounding
if one were added later - which is why insights are produced server-side and
shaped as data rather than prose.

---

## 12. The client/server boundary is checked, not trusted

Importing a **value** from a module that transitively imports Mongoose into a
`"use client"` file pulls the entire Mongo driver into the browser bundle, and
Turbopack's error for it (`Can't resolve 'tls'`) does not name the offending
import.

So the pure parts are split out into modules with no dependencies:

| Pure module | Used by |
|---|---|
| `lib/db/models/enums.ts` | forms, badges, filters |
| `lib/inventory/status.ts` | stock badges and tables |
| `lib/analytics/expense-meta.ts` | expense forms and charts |
| `lib/analytics/segments.ts` | the customer segment strip |
| `lib/sales/pricing.ts` | the POS live preview |

`npm run check:source` fails if a client component imports a server-only module
by value, and also catches look-alike Unicode in identifiers and hardcoded
currency symbols.

---

## 13. Filters and date ranges live in the URL

Every list filter and every date range is a search param. That makes a filtered
view shareable and bookmarkable, survives a refresh, and - most importantly -
means the **server** does the querying. Client-side filtering of a partially
loaded list is how filtered totals end up disagreeing with the rows above them.

---

## 14. Indexes

| Collection | Index | For |
|---|---|---|
| Sale | `{storeId, status, soldAt}` | every financial rollup |
| Sale | `{storeId, orderNumber}` unique | lookup, and no duplicate numbers |
| Sale | `{storeId, customerId, soldAt}` | customer purchase history |
| SaleItem | `{storeId, productId, soldAt}` | product performance |
| SaleItem | `{storeId, categoryId, soldAt}` | category performance |
| Product | `{storeId, sku}` unique | SKUs unique per store, not globally |
| Product | `{storeId, stock}` | low-stock scans |
| Product | text on name/sku/supplier | search |
| Expense | `{storeId, category, date}` | expense breakdown |
| InventoryMovement | `{storeId, productId, createdAt}` | per-product history |
| Membership | `{storeId, userId}` unique | one membership per person per store |
| Notification | `{storeId, dedupeKey}` unique sparse | one alert per fact per day |

Order numbers come from an atomic `$inc` on a `Counter` document, not from
counting the collection - two tills completing a sale in the same instant would
otherwise be handed the same number.

---

## 15. Rendering

Every authenticated page is `force-dynamic`. Store data is per-tenant and must
never be cached across tenants.

Within a page, `<Suspense>` streams the sections independently: the hero figures
paint as soon as the summary aggregation returns, while the products, stock,
sales and insights panels arrive on their own. Each has a skeleton shaped like
the content it replaces, so nothing jumps.

Server components do the data work. Client components are used only where there
is genuine interactivity: the chart, the till, dialogs, filters and the command
palette.
