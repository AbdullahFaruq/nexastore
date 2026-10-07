import type { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Product, type ProductDoc } from "@/lib/db/models/product";
import { getUnitsSoldByProduct } from "./products";
import { STOCK_STATUS_RANK, classifyStock, type StockStatus } from "@/lib/inventory/status";

// The classification itself is pure and lives in lib/inventory/status so that
// client components can import it without pulling in Mongoose.
export {
  STOCK_STATUS_META, STOCK_STATUS_RANK, classifyStock, type StockStatus,
} from "@/lib/inventory/status";

export interface StockInsight {
  productId: string;
  name: string;
  sku: string;
  image?: string;
  categoryName?: string;
  stock: number;
  minStock: number;
  status: StockStatus;
  /** Units sold in the lookback window. */
  soldRecently: number;
  /** Average units per day over the lookback window. */
  velocityPerDay: number;
  /**
   * Days of cover left at the current rate. null when the product has not sold
   * recently - we say "no recent sales" rather than inventing an estimate.
   */
  daysRemaining: number | null;
  /** Units to order to reach a target number of days of cover. */
  suggestedReorder: number;
  price: number;
  costPrice: number;
  stockValue: number;
}

/**
 * Stock intelligence: not a table of quantities, but "what will run out, when,
 * and how much should I order". Velocity comes from actual sales in the
 * lookback window.
 */
export async function getStockInsights(
  storeId: Types.ObjectId,
  opts: {
    lookbackDays?: number;
    targetCoverDays?: number;
    limit?: number;
    onlyAtRisk?: boolean;
    now?: Date;
  } = {},
): Promise<StockInsight[]> {
  await connectToDatabase();
  const lookbackDays = opts.lookbackDays ?? 14;
  const targetCoverDays = opts.targetCoverDays ?? 21;
  const now = opts.now ?? new Date();
  const from = new Date(now.getTime() - lookbackDays * 86_400_000);

  const [products, unitsBy, categories] = await Promise.all([
    Product.find({ storeId, status: { $ne: "archived" } })
      .select({ name: 1, sku: 1, images: 1, stock: 1, minStock: 1, price: 1, costPrice: 1, categoryId: 1 })
      .lean<ProductDoc[]>(),
    getUnitsSoldByProduct(storeId, { from, to: now }),
    import("@/lib/db/models/category").then((m) =>
      m.Category.find({ storeId }).select({ name: 1 }).lean(),
    ),
  ]);

  const catBy = new Map(categories.map((c) => [String(c._id), c.name]));

  const rows = products.map((p) => {
    const sold = unitsBy.get(String(p._id)) ?? 0;
    const velocity = sold / lookbackDays;
    const daysRemaining = velocity > 0 ? p.stock / velocity : null;
    const status = classifyStock(p.stock, p.minStock, daysRemaining);
    const target = Math.ceil(velocity * targetCoverDays);

    return {
      productId: String(p._id),
      name: p.name,
      sku: p.sku,
      image: p.images?.[0],
      categoryName: p.categoryId ? catBy.get(String(p.categoryId)) : undefined,
      stock: p.stock,
      minStock: p.minStock,
      status,
      soldRecently: sold,
      velocityPerDay: velocity,
      daysRemaining,
      suggestedReorder: Math.max(0, Math.max(target, p.minStock) - p.stock),
      price: p.price,
      costPrice: p.costPrice,
      stockValue: p.stock * p.costPrice,
    } satisfies StockInsight;
  });

  const filtered = opts.onlyAtRisk ? rows.filter((r) => r.status !== "healthy") : rows;

  filtered.sort((a, b) => {
    const rank = STOCK_STATUS_RANK[a.status] - STOCK_STATUS_RANK[b.status];
    if (rank !== 0) return rank;
    // Within a status, whatever runs out soonest comes first.
    const ad = a.daysRemaining ?? Infinity;
    const bd = b.daysRemaining ?? Infinity;
    if (ad !== bd) return ad - bd;
    return b.soldRecently - a.soldRecently;
  });

  return opts.limit ? filtered.slice(0, opts.limit) : filtered;
}

export interface InventoryTotals {
  /** Capital tied up in stock, valued at cost. */
  stockValueAtCost: number;
  /** What it would bring in at list price. */
  stockValueAtRetail: number;
  potentialProfit: number;
  totalUnits: number;
  productCount: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
}

export async function getInventoryTotals(storeId: Types.ObjectId): Promise<InventoryTotals> {
  await connectToDatabase();
  const rows = await Product.aggregate([
    { $match: { storeId, status: { $ne: "archived" } } },
    {
      $group: {
        _id: null,
        stockValueAtCost: { $sum: { $multiply: ["$stock", "$costPrice"] } },
        stockValueAtRetail: {
          $sum: {
            $multiply: [
              "$stock",
              {
                $cond: [
                  { $and: [{ $gt: ["$discountPrice", 0] }, { $lt: ["$discountPrice", "$price"] }] },
                  "$discountPrice",
                  "$price",
                ],
              },
            ],
          },
        },
        totalUnits: { $sum: "$stock" },
        productCount: { $sum: 1 },
        inStock: { $sum: { $cond: [{ $gt: ["$stock", 0] }, 1, 0] } },
        outOfStock: { $sum: { $cond: [{ $lte: ["$stock", 0] }, 1, 0] } },
        lowStock: {
          $sum: {
            $cond: [
              { $and: [{ $gt: ["$stock", 0] }, { $lte: ["$stock", "$minStock"] }] },
              1,
              0,
            ],
          },
        },
      },
    },
  ]).exec();

  const r = rows[0] ?? {};
  const cost = r.stockValueAtCost ?? 0;
  const retail = r.stockValueAtRetail ?? 0;
  return {
    stockValueAtCost: cost,
    stockValueAtRetail: retail,
    potentialProfit: retail - cost,
    totalUnits: r.totalUnits ?? 0,
    productCount: r.productCount ?? 0,
    inStock: r.inStock ?? 0,
    lowStock: r.lowStock ?? 0,
    outOfStock: r.outOfStock ?? 0,
  };
}
