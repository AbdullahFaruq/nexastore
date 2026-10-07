/**
 * Integration test for the write paths.
 *
 * Exercises the real services against a real database inside a throwaway
 * store: completing a sale, running out of stock, refunding, cancelling and
 * adjusting inventory. Asserts that stock, the ledger, the payment record and
 * the customer rollup all agree afterwards.
 *
 *   npm run check:flows
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

import mongoose, { Types } from "mongoose";
import { connectToDatabase, supportsTransactions } from "../src/lib/db/connect";
import * as models from "../src/lib/db/models";
import { cancelSale, createSale, refundSale, type SaleActor } from "../src/lib/sales/service";
import { formatMoney } from "../src/lib/format/currency";

let failures = 0;
function check(name: string, condition: boolean, detail?: string) {
  if (condition) console.log(`  ok    ${name}`);
  else {
    console.log(`  FAIL  ${name}${detail ? ` - ${detail}` : ""}`);
    failures++;
  }
}

async function main() {
  await connectToDatabase();
  const tx = await supportsTransactions();
  console.log(`\n  Transactions: ${tx ? "available" : "UNAVAILABLE (standalone mongod)"}\n`);

  const storeId = new Types.ObjectId();
  const userId = "test_runner";
  const money = (n: number) => formatMoney(n, "USD");

  // Isolated tenant, torn down at the end.
  await models.Store.create({
    _id: storeId,
    name: `Flow Test ${storeId.toString().slice(-6)}`,
    slug: `flow-test-${storeId.toString().slice(-6)}`,
    ownerUserId: userId,
    currency: "USD",
    timezone: "UTC",
    settings: { defaultTaxRateBps: 1000, orderPrefix: "TT", taxMode: "exclusive", lowStockThreshold: 5, weekStartsOn: 1 },
  });

  const actor: SaleActor = {
    storeId, userId, userName: "Test Runner",
    taxMode: "exclusive", orderPrefix: "TT",
  };

  const [widget, gadget] = await models.Product.create([
    { storeId, name: "Test Widget", sku: "TW-1", costPrice: 400, price: 1000, stock: 10, minStock: 3, taxRateBps: 1000 },
    { storeId, name: "Test Gadget", sku: "TG-1", costPrice: 2500, price: 5000, stock: 2, minStock: 1, taxRateBps: 1000 },
  ]);

  const customer = await models.Customer.create({ storeId, name: "Test Buyer" });

  /* ------------------------------------------------------- complete a sale */
  console.log("  Completing a sale");
  const { sale } = await createSale(actor, {
    items: [
      { productId: String(widget._id), quantity: 3 },
      { productId: String(gadget._id), quantity: 1 },
    ],
    customerId: String(customer._id),
    orderDiscount: 200,
    paymentMethod: "card",
    status: "completed",
  });

  check("order number uses the store prefix", sale.orderNumber.startsWith("TT-"), sale.orderNumber);
  // gross 3*1000 + 1*5000 = 8000; less the 200 order discount = 7800 revenue.
  check("revenue is net of the order discount", sale.netRevenue === 7800, money(sale.netRevenue));

  // Tax is rounded per LINE, not on the header - that is what an invoice shows
  // and what the line amounts must add up to, so the header can legitimately
  // differ from a naive 10% of the total by a unit or two.
  const naiveTax = Math.round(sale.netRevenue * 0.1);
  check("tax is charged on post-discount revenue", Math.abs(sale.taxTotal - naiveTax) <= 2,
    `${money(sale.taxTotal)} vs naive ${money(naiveTax)}`);
  check("total is revenue plus tax", sale.total === sale.netRevenue + sale.taxTotal, money(sale.total));
  check("cogs is the cost snapshot", sale.cogsTotal === 3 * 400 + 2500, money(sale.cogsTotal));

  const afterSale = await models.Product.find({ storeId }).sort({ sku: 1 }).lean();
  const gadgetAfter = afterSale.find((p) => p.sku === "TG-1")!;
  const widgetAfter = afterSale.find((p) => p.sku === "TW-1")!;
  check("stock decremented for both lines", widgetAfter.stock === 7 && gadgetAfter.stock === 1,
    `widget ${widgetAfter.stock}, gadget ${gadgetAfter.stock}`);

  const movements = await models.InventoryMovement.find({ storeId, saleId: sale._id }).lean();
  check("one ledger row per line", movements.length === 2, String(movements.length));
  check("ledger records before and after", movements.every((m) => m.stockAfter === m.stockBefore + m.quantity));

  const items = await models.SaleItem.find({ storeId, saleId: sale._id }).lean();
  check("line items reconcile to the header",
    items.reduce((a, i) => a + i.netRevenue, 0) === sale.netRevenue);
  check("line taxes sum to the header tax",
    items.reduce((a, i) => a + i.taxAmount, 0) === sale.taxTotal,
    "per-line rounding must still add up");
  check("order discount fully allocated across lines",
    items.reduce((a, i) => a + i.allocatedOrderDiscount, 0) === 200);

  const payments = await models.Payment.find({ storeId, saleId: sale._id }).lean();
  check("a capture was recorded", payments.length === 1 && payments[0].amount === sale.total);

  const custAfter = await models.Customer.findById(customer._id).lean();
  check("customer rollup updated", custAfter?.totalOrders === 1 && custAfter?.totalSpent === 7800,
    `${custAfter?.totalOrders} orders, ${money(custAfter?.totalSpent ?? 0)}`);

  /* ----------------------------------------------------- overselling fails */
  console.log("\n  Refusing to oversell");
  let oversellError: string | null = null;
  try {
    await createSale(actor, { items: [{ productId: String(gadget._id), quantity: 99 }] });
  } catch (e) {
    oversellError = (e as Error).message;
  }
  check("selling more than the shelf holds is rejected", oversellError !== null, "no error thrown");
  check("the error names the product and the shortfall",
    Boolean(oversellError?.includes("Test Gadget")), oversellError ?? "");

  const gadgetUnchanged = await models.Product.findById(gadget._id).lean();
  check("a rejected sale leaves stock untouched", gadgetUnchanged?.stock === 1, String(gadgetUnchanged?.stock));
  const saleCount = await models.Sale.countDocuments({ storeId });
  check("a rejected sale creates no order", saleCount === 1, String(saleCount));

  /* ---------------------------------------------------------- pending sale */
  console.log("\n  Pending order and cancellation");
  const { sale: pending } = await createSale(actor, {
    items: [{ productId: String(widget._id), quantity: 2 }],
    status: "pending",
  });
  const widgetReserved = await models.Product.findById(widget._id).lean();
  check("a pending order still reserves stock", widgetReserved?.stock === 5, String(widgetReserved?.stock));

  await cancelSale(actor, String(pending._id), "Customer never collected");
  const widgetRestored = await models.Product.findById(widget._id).lean();
  check("cancelling puts the stock back", widgetRestored?.stock === 7, String(widgetRestored?.stock));

  const cancelled = await models.Sale.findById(pending._id).lean();
  check("cancelled orders keep their record", cancelled?.status === "cancelled");

  /* ----------------------------------------------------- completed refund */
  console.log("\n  Refunding a completed sale");
  await refundSale(actor, String(sale._id), { reason: "Faulty", restock: true });

  const refunded = await models.Sale.findById(sale._id).lean();
  check("refund reverses revenue", refunded?.refundedRevenue === 7800, money(refunded?.refundedRevenue ?? 0));
  check("refund reverses cost too", refunded?.refundedCogs === sale.cogsTotal);
  check("original figures are preserved", refunded?.netRevenue === 7800,
    "history must not be rewritten");

  const widgetRefunded = await models.Product.findById(widget._id).lean();
  const gadgetRefunded = await models.Product.findById(gadget._id).lean();
  check("refunded goods go back on the shelf",
    widgetRefunded?.stock === 10 && gadgetRefunded?.stock === 2,
    `widget ${widgetRefunded?.stock}, gadget ${gadgetRefunded?.stock}`);

  const refundPayments = await models.Payment.find({ storeId, saleId: sale._id }).sort({ createdAt: 1 }).lean();
  check("a negative payment records the money leaving",
    refundPayments.length === 2 && refundPayments[1].amount === -sale.total);

  const custRefunded = await models.Customer.findById(customer._id).lean();
  check("customer lifetime value backs out the refund",
    custRefunded?.totalSpent === 0 && custRefunded?.totalOrders === 0,
    `${custRefunded?.totalOrders} orders, ${money(custRefunded?.totalSpent ?? 0)}`);

  let doubleRefund: string | null = null;
  try {
    await refundSale(actor, String(sale._id));
  } catch (e) {
    doubleRefund = (e as Error).message;
  }
  check("an order cannot be refunded twice", doubleRefund !== null);

  /* ------------------------------------------------ analytics agree after */
  console.log("\n  Analytics after the reversals");
  const { getPeriodTotals } = await import("../src/lib/analytics/summary");
  const totals = await getPeriodTotals(storeId, {
    from: new Date(Date.now() - 86_400_000),
    to: new Date(Date.now() + 86_400_000),
  });
  check("a fully refunded store shows zero revenue", totals.revenue === 0, money(totals.revenue));
  check("a fully refunded store shows zero cost of goods", totals.cogs === 0, money(totals.cogs));
  check("cancelled orders never entered the books", totals.orders === 1,
    `${totals.orders} recognised orders (the refunded one)`);

  /* ----------------------------------------------------- tenant isolation */
  console.log("\n  Tenant isolation");
  const otherStore = new Types.ObjectId();
  const otherActor: SaleActor = { ...actor, storeId: otherStore };
  let crossTenant: string | null = null;
  try {
    await createSale(otherActor, { items: [{ productId: String(widget._id), quantity: 1 }] });
  } catch (e) {
    crossTenant = (e as Error).message;
  }
  check("a product id from another store does not resolve", crossTenant !== null, "sale succeeded across tenants");

  /* --------------------------------------------------------------- teardown */
  for (const model of [
    models.SaleItem, models.Sale, models.Payment, models.InventoryMovement,
    models.Product, models.Customer, models.Counter, models.Notification, models.Store,
  ]) {
    await (model as unknown as { deleteMany: (f: object) => Promise<unknown> }).deleteMany({
      $or: [{ storeId }, { _id: storeId }],
    });
  }
  await models.Counter.deleteMany({ storeId: otherStore });

  console.log(`\n  ${failures === 0 ? "All flow checks passed." : `${failures} CHECK(S) FAILED`}\n`);
  await mongoose.disconnect();
  if (failures > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
