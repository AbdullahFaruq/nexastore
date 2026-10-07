import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/context";
import { connectToDatabase } from "@/lib/db/connect";
import { Category } from "@/lib/db/models/category";
import { PageBody, PageHeader } from "@/components/shared/page-header";
import { EMPTY_PRODUCT, ProductForm } from "@/components/products/product-form";

export const metadata: Metadata = { title: "Add product" };
export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const ctx = await requirePermission("products:write");
  await connectToDatabase();

  const categories = await Category.find({ storeId: ctx.storeId })
    .sort({ sortOrder: 1, name: 1 })
    .select({ name: 1 })
    .lean();

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Products", href: "/products" }, { label: "New" }]}
        title="Add a product"
        description="Enter the cost and the selling price, and NexaStore works out the margin from there."
      />
      <PageBody>
        <ProductForm
          initial={EMPTY_PRODUCT}
          categories={categories.map((c) => ({ id: String(c._id), name: c.name }))}
          defaultTaxRatePct={(ctx.store.settings?.defaultTaxRateBps ?? 0) / 100}
        />
      </PageBody>
    </>
  );
}
