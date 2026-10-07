import type { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Customer } from "@/lib/db/models/customer";
import { Expense } from "@/lib/db/models/expense";
import { InventoryMovement } from "@/lib/db/models/inventory-movement";
import { Product } from "@/lib/db/models/product";
import { Sale } from "@/lib/db/models/sale";
import { EXPENSE_CATEGORY_META } from "@/lib/analytics/expense-meta";
import { getCategoryPerformance, getPeriodTotals, getTopProducts } from "@/lib/analytics";
import { getStockInsights } from "@/lib/analytics/inventory";
import { getVipFloor, segmentOf } from "@/lib/analytics/customers";
import { SEGMENT_META } from "@/lib/analytics/segments";
import { formatMoney, toMajor } from "@/lib/format/currency";
import { formatDate, type ResolvedRange } from "@/lib/format/dates";
import { unitEconomics } from "@/lib/sales/pricing";

export type ReportType =
  | "sales" | "revenue" | "expenses" | "profit" | "inventory" | "products" | "customers";

export const REPORT_TYPES: {
  value: ReportType;
  label: string;
  description: string;
  permission: "reports:view" | "inventory:view";
}[] = [
  { value: "profit", label: "Profit & loss", description: "Revenue down to net profit, line by line.", permission: "reports:view" },
  { value: "revenue", label: "Revenue summary", description: "Daily takings, orders and margin over the period.", permission: "reports:view" },
  { value: "sales", label: "Sales ledger", description: "Every transaction with its totals and status.", permission: "reports:view" },
  { value: "products", label: "Product performance", description: "Units, revenue, profit and margin per product.", permission: "reports:view" },
  { value: "expenses", label: "Expense ledger", description: "Every cost recorded, with category and vendor.", permission: "reports:view" },
  { value: "inventory", label: "Inventory valuation", description: "Stock on hand, its value, and days of cover.", permission: "inventory:view" },
  { value: "customers", label: "Customer list", description: "Orders, lifetime value and segment per customer.", permission: "reports:view" },
];

export interface ReportColumn {
  key: string;
  label: string;
  align?: "left" | "right";
  /** Rendered value for the on-screen preview. */
  format?: (value: unknown) => string;
}

export interface ReportResult {
  title: string;
  subtitle: string;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  /** Summary lines shown above the table and appended to the CSV. */
  summary: { label: string; value: string }[];
  generatedAt: string;
}

/**
 * Report builders.
 *
 * Every report is derived from the same aggregation helpers the dashboard uses,
 * so an exported CSV and the screen it came from can never disagree. Money is
 * exported in MAJOR units with the currency code in a header line, because a
 * spreadsheet is going to do arithmetic on these columns.
 */
export async function buildReport(
  storeId: Types.ObjectId,
  type: ReportType,
  range: ResolvedRange,
  opts: { currency: string; timezone: string; storeName: string },
): Promise<ReportResult> {
  await connectToDatabase();
  const { currency, timezone, storeName } = opts;
  const money = (n: number) => formatMoney(n, currency);
  const major = (n: number) => toMajor(n, currency);

  const base = {
    subtitle: `${storeName} - ${range.label}${range.isPartial ? " so far" : ""} (${formatDate(range.from, timezone)} to ${formatDate(new Date(range.to.getTime() - 1), timezone)})`,
    generatedAt: new Date().toISOString(),
  };

  switch (type) {
    /* ------------------------------------------------------------ profit */
    case "profit": {
      const { getProfitAndLoss } = await import("@/lib/analytics/pnl");
      const pnl = await getProfitAndLoss(storeId, range);
      return {
        ...base,
        title: "Profit & loss",
        columns: [
          { key: "line", label: "Line" },
          { key: "amount", label: `Amount (${currency})`, align: "right" },
          { key: "ofRevenue", label: "Percent of revenue", align: "right" },
        ],
        rows: pnl.lines.map((l) => ({
          line: `${"  ".repeat(l.depth)}${l.label}`,
          amount: major(l.amount),
          ofRevenue: l.ofRevenuePct === undefined || !Number.isFinite(l.ofRevenuePct)
            ? ""
            : Number(l.ofRevenuePct.toFixed(1)),
          _display: {
            amount: money(l.amount),
            ofRevenue:
              l.ofRevenuePct === undefined || !Number.isFinite(l.ofRevenuePct)
                ? "-"
                : `${l.ofRevenuePct.toFixed(1)}%`,
          },
        })),
        summary: [
          { label: "Net revenue", value: money(pnl.totals.revenue) },
          { label: "Gross profit", value: money(pnl.totals.grossProfit) },
          { label: "Operating expenses", value: money(pnl.totals.expenses) },
          { label: "Net profit", value: money(pnl.totals.netProfit) },
          { label: "Net margin", value: `${pnl.totals.netMarginPct.toFixed(1)}%` },
        ],
      };
    }

    /* ----------------------------------------------------------- revenue */
    case "revenue": {
      const { getTimeSeries } = await import("@/lib/analytics/timeseries");
      const series = await getTimeSeries(storeId, range, "day", timezone, 1);
      const totals = await getPeriodTotals(storeId, range);
      return {
        ...base,
        title: "Revenue summary",
        columns: [
          { key: "date", label: "Date" },
          { key: "orders", label: "Orders", align: "right" },
          { key: "items", label: "Items", align: "right" },
          { key: "revenue", label: `Revenue (${currency})`, align: "right" },
          { key: "cogs", label: `Cost of goods (${currency})`, align: "right" },
          { key: "expenses", label: `Expenses (${currency})`, align: "right" },
          { key: "profit", label: `Net profit (${currency})`, align: "right" },
        ],
        rows: series.points.map((p) => ({
          date: formatDate(p.t, timezone),
          orders: p.orders,
          items: p.items,
          revenue: major(p.revenue),
          cogs: major(p.cogs),
          expenses: major(p.expenses),
          profit: major(p.profit),
          _display: {
            revenue: money(p.revenue),
            cogs: money(p.cogs),
            expenses: money(p.expenses),
            profit: money(p.profit),
          },
        })),
        summary: [
          { label: "Revenue", value: money(totals.revenue) },
          { label: "Orders", value: totals.orders.toLocaleString() },
          { label: "Average order", value: money(totals.averageOrderValue) },
          { label: "Net profit", value: money(totals.netProfit) },
        ],
      };
    }

    /* ------------------------------------------------------------- sales */
    case "sales": {
      const sales = await Sale.find({
        storeId,
        soldAt: { $gte: range.from, $lt: range.to },
      })
        .sort({ soldAt: -1 })
        .limit(5000)
        .lean();
      const totals = await getPeriodTotals(storeId, range);

      return {
        ...base,
        title: "Sales ledger",
        columns: [
          { key: "orderNumber", label: "Order" },
          { key: "date", label: "Date" },
          { key: "customer", label: "Customer" },
          { key: "items", label: "Items", align: "right" },
          { key: "gross", label: `Gross (${currency})`, align: "right" },
          { key: "discount", label: `Discount (${currency})`, align: "right" },
          { key: "revenue", label: `Net revenue (${currency})`, align: "right" },
          { key: "tax", label: `Tax (${currency})`, align: "right" },
          { key: "total", label: `Total (${currency})`, align: "right" },
          { key: "payment", label: "Payment" },
          { key: "status", label: "Status" },
        ],
        rows: sales.map((s) => ({
          orderNumber: s.orderNumber,
          date: formatDate(s.soldAt, timezone),
          customer: s.customerName ?? "Walk-in",
          items: s.itemCount,
          gross: major(s.grossAmount),
          discount: major(s.discountTotal),
          revenue: major(s.netRevenue - s.refundedRevenue),
          tax: major(s.taxTotal),
          total: major(s.total),
          payment: s.paymentMethod.replace("_", " "),
          status: s.status,
          _display: {
            gross: money(s.grossAmount),
            discount: money(s.discountTotal),
            revenue: money(s.netRevenue - s.refundedRevenue),
            tax: money(s.taxTotal),
            total: money(s.total),
          },
        })),
        summary: [
          { label: "Orders", value: sales.length.toLocaleString() },
          { label: "Recognised revenue", value: money(totals.revenue) },
          { label: "Tax collected", value: money(totals.tax) },
          { label: "Refunds", value: money(totals.refunds) },
        ],
      };
    }

    /* ---------------------------------------------------------- products */
    case "products": {
      const rows = await getTopProducts(storeId, range, { limit: 500 });
      const categories = await getCategoryPerformance(storeId, range);
      return {
        ...base,
        title: "Product performance",
        columns: [
          { key: "name", label: "Product" },
          { key: "sku", label: "SKU" },
          { key: "category", label: "Category" },
          { key: "units", label: "Units sold", align: "right" },
          { key: "revenue", label: `Revenue (${currency})`, align: "right" },
          { key: "cogs", label: `Cost (${currency})`, align: "right" },
          { key: "profit", label: `Profit (${currency})`, align: "right" },
          { key: "margin", label: "Margin percent", align: "right" },
          { key: "stock", label: "Stock now", align: "right" },
        ],
        rows: rows.map((p) => ({
          name: p.name,
          sku: p.sku,
          category: p.categoryName ?? "Uncategorised",
          units: p.unitsSold,
          revenue: major(p.revenue),
          cogs: major(p.cogs),
          profit: major(p.profit),
          margin: Number(p.marginPct.toFixed(1)),
          stock: p.currentStock,
          _display: {
            revenue: money(p.revenue),
            cogs: money(p.cogs),
            profit: money(p.profit),
            margin: `${p.marginPct.toFixed(1)}%`,
          },
        })),
        summary: [
          { label: "Products sold", value: rows.length.toLocaleString() },
          { label: "Units", value: rows.reduce((a, p) => a + p.unitsSold, 0).toLocaleString() },
          { label: "Revenue", value: money(rows.reduce((a, p) => a + p.revenue, 0)) },
          { label: "Categories trading", value: String(categories.filter((c) => c.revenue > 0).length) },
        ],
      };
    }

    /* ---------------------------------------------------------- expenses */
    case "expenses": {
      const expenses = await Expense.find({
        storeId,
        date: { $gte: range.from, $lt: range.to },
      })
        .sort({ date: -1 })
        .limit(5000)
        .lean();
      const total = expenses.reduce((a, e) => a + e.amount, 0);

      return {
        ...base,
        title: "Expense ledger",
        columns: [
          { key: "date", label: "Date" },
          { key: "category", label: "Category" },
          { key: "description", label: "Description" },
          { key: "vendor", label: "Paid to" },
          { key: "method", label: "Method" },
          { key: "amount", label: `Amount (${currency})`, align: "right" },
        ],
        rows: expenses.map((e) => ({
          date: formatDate(e.date, timezone),
          category: EXPENSE_CATEGORY_META[e.category]?.label ?? e.category,
          description: e.description,
          vendor: e.vendor ?? "",
          method: e.paymentMethod.replace("_", " "),
          amount: major(e.amount),
          _display: { amount: money(e.amount) },
        })),
        summary: [
          { label: "Entries", value: expenses.length.toLocaleString() },
          { label: "Total", value: money(total) },
          {
            label: "Largest",
            value: expenses.length ? money(Math.max(...expenses.map((e) => e.amount))) : money(0),
          },
        ],
      };
    }

    /* --------------------------------------------------------- inventory */
    case "inventory": {
      const insights = await getStockInsights(storeId, {});
      const movements = await InventoryMovement.countDocuments({
        storeId,
        createdAt: { $gte: range.from, $lt: range.to },
      });
      const products = await Product.find({ storeId, status: { $ne: "archived" } })
        .select({ price: 1, discountPrice: 1, costPrice: 1 })
        .lean();
      const retail = products.reduce((a, p) => {
        const e = unitEconomics(p.price, p.costPrice, p.discountPrice);
        return a + e.effectivePrice;
      }, 0);

      return {
        ...base,
        title: "Inventory valuation",
        subtitle: `${storeName} - stock position as at ${formatDate(new Date(), timezone)}`,
        columns: [
          { key: "name", label: "Product" },
          { key: "sku", label: "SKU" },
          { key: "category", label: "Category" },
          { key: "stock", label: "In stock", align: "right" },
          { key: "minStock", label: "Reorder at", align: "right" },
          { key: "unitCost", label: `Unit cost (${currency})`, align: "right" },
          { key: "value", label: `Stock value (${currency})`, align: "right" },
          { key: "sold14", label: "Sold / 14d", align: "right" },
          { key: "cover", label: "Days cover", align: "right" },
          { key: "status", label: "Status" },
        ],
        rows: insights.map((r) => ({
          name: r.name,
          sku: r.sku,
          category: r.categoryName ?? "Uncategorised",
          stock: r.stock,
          minStock: r.minStock,
          unitCost: major(r.costPrice),
          value: major(r.stockValue),
          sold14: r.soldRecently,
          cover: r.daysRemaining === null ? "" : Number(r.daysRemaining.toFixed(1)),
          status: r.status,
          _display: { unitCost: money(r.costPrice), value: money(r.stockValue) },
        })),
        summary: [
          { label: "Products", value: insights.length.toLocaleString() },
          { label: "Stock value at cost", value: money(insights.reduce((a, r) => a + r.stockValue, 0)) },
          { label: "Retail value of one of each", value: money(retail) },
          { label: "Movements in period", value: movements.toLocaleString() },
        ],
      };
    }

    /* --------------------------------------------------------- customers */
    case "customers": {
      const [customers, vipFloor] = await Promise.all([
        Customer.find({ storeId }).sort({ totalSpent: -1 }).limit(5000).lean(),
        getVipFloor(storeId),
      ]);

      return {
        ...base,
        title: "Customer list",
        subtitle: `${storeName} - all customers as at ${formatDate(new Date(), timezone)}`,
        columns: [
          { key: "name", label: "Customer" },
          { key: "email", label: "Email" },
          { key: "phone", label: "Phone" },
          { key: "segment", label: "Segment" },
          { key: "orders", label: "Orders", align: "right" },
          { key: "spent", label: `Lifetime value (${currency})`, align: "right" },
          { key: "aov", label: `Average order (${currency})`, align: "right" },
          { key: "last", label: "Last purchase" },
        ],
        rows: customers.map((c) => ({
          name: c.name,
          email: c.email ?? "",
          phone: c.phone ?? "",
          segment: SEGMENT_META[segmentOf(c, vipFloor)].label,
          orders: c.totalOrders,
          spent: major(c.totalSpent),
          aov: major(c.totalOrders > 0 ? Math.round(c.totalSpent / c.totalOrders) : 0),
          last: c.lastPurchaseAt ? formatDate(c.lastPurchaseAt, timezone) : "",
          _display: {
            spent: money(c.totalSpent),
            aov: money(c.totalOrders > 0 ? Math.round(c.totalSpent / c.totalOrders) : 0),
          },
        })),
        summary: [
          { label: "Customers", value: customers.length.toLocaleString() },
          { label: "Purchasing", value: customers.filter((c) => c.totalOrders > 0).length.toLocaleString() },
          { label: "Total lifetime value", value: money(customers.reduce((a, c) => a + c.totalSpent, 0)) },
        ],
      };
    }
  }
}

/**
 * Serialise a report as CSV.
 *
 * Fields are quoted and internal quotes doubled per RFC 4180, and any value
 * that starts with =, +, - or @ is prefixed with a single quote - otherwise a
 * product named "=cmd" becomes a formula the moment the file is opened in a
 * spreadsheet.
 */
export function toCsv(report: ReportResult, meta: { currency: string }): string {
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return "";
    let s = String(value);

    // Formula-injection guard. A leading "-" is only neutralised when the value
    // is not actually a number - blanket-quoting every negative would turn
    // -765.36 into text and break the arithmetic the export exists for.
    const numeric = typeof value === "number" || (s !== "" && Number.isFinite(Number(s)));
    if (/^[=+@\t\r]/.test(s) || (/^-/.test(s) && !numeric)) s = `'${s}`;

    return `"${s.replace(/"/g, '""')}"`;
  };

  const lines: string[] = [];
  lines.push(escape(report.title));
  lines.push(escape(report.subtitle));
  lines.push(escape(`Generated ${new Date(report.generatedAt).toISOString()}`));
  lines.push(escape(`All amounts in ${meta.currency}`));
  lines.push("");

  for (const s of report.summary) lines.push([escape(s.label), escape(s.value)].join(","));
  lines.push("");

  lines.push(report.columns.map((c) => escape(c.label)).join(","));
  for (const row of report.rows) {
    lines.push(report.columns.map((c) => escape(row[c.key])).join(","));
  }

  // A BOM so Excel opens UTF-8 correctly rather than mangling accented names.
  return `﻿${lines.join("\r\n")}\r\n`;
}
