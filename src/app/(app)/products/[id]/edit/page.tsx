import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { requirePermission } from "@/lib/auth/context";
import { connectToDatabase } from "@/lib/db/connect";
import { Category } from "@/lib/db/models/category";
import { Product } from "@/lib/db/models/product";
import { SaleItem } from "@/lib/db/models/sale-item";
import { toMajor } from "@/lib/format/currency";
import { PageBody, PageHeader } from "@/components/shared/page-header";
import { ProductForm } from "@/components/products/product-form";

export const metadata: Metadata = { title: "Edit product" };
export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: PageProps<"/products/[id]/edit">) {
  const { id } = await params;
  const ctx = await requirePermission("products:write");
  if (!Types.ObjectId.isValid(id)) notFound();

  await connectToDatabase();
  const product = await Product.findOne({ _id: new Types.ObjectId(id), storeId: ctx.storeId }).lean();
  if (!product) notFound();

  const [categories, soldCount] = await Promise.all([
    Category.find({ storeId: ctx.storeId }).sort({ sortOrder: 1, name: 1 }).select({ name: 1 }).lean(),
    SaleItem.countDocuments({ storeId: ctx.storeId, productId: product._id }),
  ]);

  const asInput = (minor: number | null | undefined) =>
    minor == null ? "" : String(toMajor(minor, ctx.currency));

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Products", href: "/products" },
          { label: product.name, href: `/products/${id}` },
          { label: "Edit" },
        ]}
        title={`Edit ${product.name}`}
        description="Changing the stock figure here is recorded as an inventory adjustment."
      />
      <PageBody>
        <ProductForm
          initial={{
            id: String(product._id),
            name: product.name,
            sku: product.sku,
            barcode: product.barcode ?? "",
            description: product.description ?? "",
            imageUrl: product.images?.[0] ?? "",
            categoryId: product.categoryId ? String(product.categoryId) : "",
            supplier: product.supplier ?? "",
            costPrice: asInput(product.costPrice),
            price: asInput(product.price),
            discountPrice: asInput(product.discountPrice),
            stock: String(product.stock),
            minStock: String(product.minStock),
            taxRatePct: String(product.taxRateBps / 100),
            unit: product.unit,
            status: product.status,
          }}
          categories={categories.map((c) => ({ id: String(c._id), name: c.name }))}
          hasSalesHistory={soldCount > 0}
        />
      </PageBody>
    </>
  );
}
