import type { Metadata } from "next";
import { requireStoreContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { getCategoryPerformance } from "@/lib/analytics/categories";
import { connectToDatabase } from "@/lib/db/connect";
import { Category } from "@/lib/db/models/category";
import { rangeFromParams } from "@/lib/range-params";
import { PageBody, PageHeader } from "@/components/shared/page-header";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { CategoryManager } from "@/components/analytics/category-manager";
import { CategoryPerformanceTable } from "@/components/analytics/category-performance";

export const metadata: Metadata = { title: "Categories" };
export const dynamic = "force-dynamic";

export default async function CategoriesPage({ searchParams }: PageProps<"/categories">) {
  const ctx = await requireStoreContext();
  const params = await searchParams;
  await connectToDatabase();

  const range = rangeFromParams(params, ctx.timezone, ctx.weekStartsOn, "this_month");

  const [categories, performance] = await Promise.all([
    Category.find({ storeId: ctx.storeId }).sort({ sortOrder: 1, name: 1 }).lean(),
    getCategoryPerformance(ctx.storeId, range),
  ]);

  const perfBy = new Map(performance.map((p) => [p.categoryId, p]));

  return (
    <>
      <PageHeader
        title="Categories"
        description="Group your catalogue so you can see which parts of the business are working."
        actions={<DateRangePicker defaultPreset="this_month" />}
      />

      <PageBody className="space-y-4">
        {can(ctx.role, "analytics:view") ? (
          <CategoryPerformanceTable categories={performance} />
        ) : null}

        <CategoryManager
          canEdit={can(ctx.role, "products:write")}
          canDelete={can(ctx.role, "products:delete")}
          categories={categories.map((c) => {
            const p = perfBy.get(String(c._id));
            return {
              id: String(c._id),
              name: c.name,
              description: c.description,
              colorSlot: c.colorSlot,
              productCount: p?.productCount ?? 0,
              revenue: p?.revenue ?? 0,
              unitsSold: p?.unitsSold ?? 0,
            };
          })}
        />
      </PageBody>
    </>
  );
}
