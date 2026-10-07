import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/context";
import { connectToDatabase } from "@/lib/db/connect";
import { Category } from "@/lib/db/models/category";
import { Customer } from "@/lib/db/models/customer";
import { Product } from "@/lib/db/models/product";
import { PosTerminal, type PosCustomer, type PosProduct } from "@/components/pos/pos-terminal";

export const metadata: Metadata = { title: "New sale" };
export const dynamic = "force-dynamic";

/**
 * The till.
 *
 * The whole active catalogue is sent to the client up front so search and
 * scanning are instant - a request per keystroke is the wrong trade at a
 * counter with a queue. Prices travel down for display only; the server
 * re-derives every figure when the sale is submitted.
 */
export default async function PosPage() {
  const ctx = await requirePermission("sales:create");
  await connectToDatabase();

  const [products, categories, customers] = await Promise.all([
    Product.find({ storeId: ctx.storeId, status: "active" })
      .sort({ name: 1 })
      .limit(1000)
      .select({ name: 1, sku: 1, barcode: 1, price: 1, discountPrice: 1, stock: 1, categoryId: 1, images: 1, taxRateBps: 1, unit: 1 })
      .lean(),
    Category.find({ storeId: ctx.storeId }).sort({ sortOrder: 1, name: 1 }).select({ name: 1 }).lean(),
    Customer.find({ storeId: ctx.storeId })
      .sort({ lastPurchaseAt: -1, name: 1 })
      .limit(500)
      .select({ name: 1, email: 1, phone: 1, totalOrders: 1 })
      .lean(),
  ]);

  const posProducts: PosProduct[] = products.map((p) => ({
    id: String(p._id),
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    price: p.discountPrice && p.discountPrice > 0 && p.discountPrice < p.price ? p.discountPrice : p.price,
    listPrice: p.price,
    stock: p.stock,
    categoryId: p.categoryId ? String(p.categoryId) : null,
    image: p.images?.[0],
    taxRateBps: p.taxRateBps,
    unit: p.unit,
  }));

  const posCustomers: PosCustomer[] = customers.map((c) => ({
    id: String(c._id),
    name: c.name,
    email: c.email,
    phone: c.phone,
    totalOrders: c.totalOrders,
  }));

  return (
    <PosTerminal
      products={posProducts}
      categories={categories.map((c) => ({ id: String(c._id), name: c.name }))}
      customers={posCustomers}
      taxMode={ctx.store.settings?.taxMode ?? "exclusive"}
    />
  );
}
