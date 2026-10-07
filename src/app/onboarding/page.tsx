import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStoreContext } from "@/lib/auth/context";
import { getAuthUser } from "@/lib/auth/provider";
import { connectToDatabase } from "@/lib/db/connect";
import { Product } from "@/lib/db/models/product";
import { Category } from "@/lib/db/models/category";
import { Sale } from "@/lib/db/models/sale";
import { OnboardingWizard } from "@/components/onboarding/wizard";
import { COMMON_TIMEZONES } from "@/lib/format/dates";
import { CURRENCY_LIST } from "@/lib/format/currency";

export const metadata: Metadata = { title: "Set up your store" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const user = await getAuthUser();
  if (!user) redirect("/sign-in");

  const params = await searchParams;
  const wantsNew = params?.new === "1";

  const ctx = await getStoreContext();

  // Already set up and not explicitly adding another store: nothing to do here.
  if (ctx?.store.onboardingCompleted && !wantsNew) redirect("/dashboard");

  let existing = null;
  if (ctx && !wantsNew) {
    await connectToDatabase();
    const [products, categories, sales] = await Promise.all([
      Product.countDocuments({ storeId: ctx.storeId }),
      Category.find({ storeId: ctx.storeId }).select({ name: 1 }).sort({ sortOrder: 1 }).lean(),
      Sale.countDocuments({ storeId: ctx.storeId }),
    ]);
    existing = {
      storeId: String(ctx.storeId),
      storeName: ctx.store.name,
      currency: ctx.currency,
      productCount: products,
      saleCount: sales,
      step: ctx.store.onboardingStep ?? 1,
      categories: categories.map((c) => ({ id: String(c._id), name: c.name })),
    };
  }

  return (
    <OnboardingWizard
      userName={user.displayName ?? "there"}
      existing={existing}
      currencies={CURRENCY_LIST.map((c) => ({ code: c.code, name: c.name, symbol: c.symbol }))}
      timezones={COMMON_TIMEZONES}
    />
  );
}
