import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireStoreContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import { Category } from "@/lib/db/models/category";
import { Product } from "@/lib/db/models/product";
import { PRODUCT_STATUSES } from "@/lib/db/models/enums";
import { first, pageFromParams } from "@/lib/range-params";
import { PageBody, PageHeader } from "@/components/shared/page-header";
import { ActiveFilters, Pagination, SearchFilter, SelectFilter } from "@/components/shared/filter-bar";
import { ProductTable, type ProductRow } from "@/components/products/product-table";
import { Panel, PanelFooter } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Products" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const ctx = await requireStoreContext();
  const params = await searchParams;
  await connectToDatabase();

  const page = pageFromParams(params);
  const q = first(params, "q")?.trim();
  const categoryId = first(params, "categoryId");
  const status = first(params, "status");
  const stock = first(params, "stock");
  const sort = first(params, "sort") ?? "newest";

  const filter: Record<string, unknown> = { storeId: ctx.storeId };
  if (status && PRODUCT_STATUSES.includes(status as never)) filter.status = status;
  else if (!status) filter.status = { $ne: "archived" };

  if (categoryId && categoryId !== "all") {
    filter.categoryId = categoryId === "none" ? null : categoryId;
  }
  if (q) {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(safe, "i");
    filter.$or = [{ name: rx }, { sku: rx }, { barcode: rx }, { supplier: rx }];
  }
  if (stock === "out") filter.stock = { $lte: 0 };
  else if (stock === "low") filter.$expr = { $and: [{ $gt: ["$stock", 0] }, { $lte: ["$stock", "$minStock"] }] };
  else if (stock === "healthy") filter.$expr = { $gt: ["$stock", "$minStock"] };

  const sortSpec: Record<string, 1 | -1> =
    sort === "name" ? { name: 1 }
    : sort === "price_high" ? { price: -1 }
    : sort === "price_low" ? { price: 1 }
    : sort === "stock_low" ? { stock: 1 }
    : sort === "stock_high" ? { stock: -1 }
    : { createdAt: -1 };

  const [rows, total, categories] = await Promise.all([
    Product.find(filter)
      .sort(sortSpec)
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    Product.countDocuments(filter),
    Category.find({ storeId: ctx.storeId }).sort({ sortOrder: 1, name: 1 }).select({ name: 1 }).lean(),
  ]);

  const catBy = new Map(categories.map((c) => [String(c._id), c.name]));

  const products: ProductRow[] = rows.map((p) => ({
    id: String(p._id),
    name: p.name,
    sku: p.sku,
    image: p.images?.[0],
    categoryName: p.categoryId ? catBy.get(String(p.categoryId)) : undefined,
    supplier: p.supplier,
    costPrice: p.costPrice,
    price: p.price,
    discountPrice: p.discountPrice ?? null,
    stock: p.stock,
    minStock: p.minStock,
    status: p.status,
    unit: p.unit,
  }));

  const activeFilters = [
    q ? { key: "q", label: "Search", value: q } : null,
    categoryId && categoryId !== "all"
      ? { key: "categoryId", label: "Category", value: categoryId === "none" ? "Uncategorised" : (catBy.get(categoryId) ?? "Unknown") }
      : null,
    status ? { key: "status", label: "Status", value: status } : null,
    stock && stock !== "all" ? { key: "stock", label: "Stock", value: stock } : null,
  ].filter(Boolean) as { key: string; label: string; value: string }[];

  return (
    <>
      <PageHeader
        title="Products"
        description="Your catalogue, with cost, margin and stock in one view."
        actions={
          can(ctx.role, "products:write") ? (
            <Button asChild variant="primary" size="sm">
              <Link href="/products/new">
                <Plus />
                Add product
              </Link>
            </Button>
          ) : null
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <SearchFilter placeholder="Name, SKU, barcode or supplier" className="w-full sm:w-[260px]" />
          <SelectFilter
            paramKey="categoryId"
            label="Category"
            options={[
              { value: "all", label: "All categories" },
              ...categories.map((c) => ({ value: String(c._id), label: c.name })),
              { value: "none", label: "Uncategorised" },
            ]}
          />
          <SelectFilter
            paramKey="stock"
            label="Stock level"
            options={[
              { value: "all", label: "Any stock level" },
              { value: "healthy", label: "Healthy" },
              { value: "low", label: "At or below reorder" },
              { value: "out", label: "Out of stock" },
            ]}
          />
          <SelectFilter
            paramKey="status"
            label="Status"
            options={[
              { value: "all", label: "Active and draft" },
              ...PRODUCT_STATUSES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) })),
            ]}
          />
          <SelectFilter
            paramKey="sort"
            label="Sort"
            options={[
              { value: "newest", label: "Newest first" },
              { value: "name", label: "Name A-Z" },
              { value: "price_high", label: "Price high to low" },
              { value: "price_low", label: "Price low to high" },
              { value: "stock_low", label: "Least stock" },
              { value: "stock_high", label: "Most stock" },
            ]}
          />
        </div>
        {activeFilters.length > 0 ? (
          <div className="mt-2.5">
            <ActiveFilters filters={activeFilters} />
          </div>
        ) : null}
      </PageHeader>

      <PageBody>
        <Panel>
          <ProductTable
            products={products}
            canEdit={can(ctx.role, "products:write")}
            showMargins={can(ctx.role, "analytics:view")}
            filtered={activeFilters.length > 0}
          />
          {products.length > 0 ? (
            <PanelFooter>
              <Pagination
                page={page}
                pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
                total={total}
                label="products"
              />
            </PanelFooter>
          ) : null}
        </Panel>
      </PageBody>
    </>
  );
}
