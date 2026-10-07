import { NextResponse } from "next/server";
import { getStoreContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import { Customer } from "@/lib/db/models/customer";
import { Product } from "@/lib/db/models/product";
import { Sale } from "@/lib/db/models/sale";
import { formatMoney } from "@/lib/format/currency";
import { formatDate } from "@/lib/format/dates";

export interface SearchHit {
  id: string;
  type: "product" | "order" | "customer";
  title: string;
  subtitle: string;
  meta?: string;
  href: string;
  image?: string;
}

/**
 * Global search for the command palette.
 *
 * Every query is scoped to the caller's store and filtered by their role - an
 * employee searching will never surface a record they cannot open. Results are
 * capped tightly because this fires on every keystroke.
 */
export async function GET(request: Request) {
  const ctx = await getStoreContext();
  if (!ctx) return NextResponse.json({ hits: [] }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ hits: [] });

  await connectToDatabase();

  // Escaped so a user typing "(" cannot break - or exploit - the query.
  const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx = new RegExp(safe, "i");
  const hits: SearchHit[] = [];

  const tasks: Promise<void>[] = [];

  if (can(ctx.role, "products:view")) {
    tasks.push(
      Product.find({
        storeId: ctx.storeId,
        $or: [{ name: rx }, { sku: rx }, { barcode: rx }, { supplier: rx }],
      })
        .limit(6)
        .select({ name: 1, sku: 1, price: 1, discountPrice: 1, stock: 1, images: 1 })
        .lean()
        .then((rows) => {
          for (const p of rows) {
            hits.push({
              id: String(p._id),
              type: "product",
              title: p.name,
              subtitle: p.sku,
              meta: `${formatMoney(p.discountPrice || p.price, ctx.currency)} - ${p.stock} in stock`,
              href: `/products/${String(p._id)}`,
              image: p.images?.[0],
            });
          }
        }),
    );
  }

  if (can(ctx.role, "sales:view")) {
    tasks.push(
      Sale.find({
        storeId: ctx.storeId,
        $or: [{ orderNumber: rx }, { customerName: rx }],
      })
        .sort({ soldAt: -1 })
        .limit(6)
        .select({ orderNumber: 1, customerName: 1, total: 1, soldAt: 1, status: 1 })
        .lean()
        .then((rows) => {
          for (const s of rows) {
            hits.push({
              id: String(s._id),
              type: "order",
              title: s.orderNumber,
              subtitle: s.customerName || "Walk-in customer",
              meta: `${formatMoney(s.total, ctx.currency)} - ${formatDate(s.soldAt, ctx.timezone)}`,
              href: `/sales/${String(s._id)}`,
            });
          }
        }),
    );
  }

  if (can(ctx.role, "customers:view")) {
    tasks.push(
      Customer.find({
        storeId: ctx.storeId,
        $or: [{ name: rx }, { email: rx }, { phone: rx }],
      })
        .limit(6)
        .select({ name: 1, email: 1, phone: 1, totalSpent: 1, totalOrders: 1 })
        .lean()
        .then((rows) => {
          for (const c of rows) {
            hits.push({
              id: String(c._id),
              type: "customer",
              title: c.name,
              subtitle: c.email || c.phone || "No contact details",
              meta: `${c.totalOrders} order${c.totalOrders === 1 ? "" : "s"} - ${formatMoney(c.totalSpent, ctx.currency)}`,
              href: `/customers/${String(c._id)}`,
            });
          }
        }),
    );
  }

  await Promise.all(tasks);
  return NextResponse.json({ hits });
}
