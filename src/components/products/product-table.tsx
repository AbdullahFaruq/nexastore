"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Package, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format/currency";
import { unitEconomics } from "@/lib/sales/pricing";
import { classifyStock } from "@/lib/inventory/status";
import { useStore } from "@/components/providers/store-provider";
import { ProductTile } from "@/components/shared/product-tile";
import { ProductStatusBadge, StockStatusBadge } from "@/components/ui/status-badge";
import { EmptyBoxMark, EmptyState } from "@/components/ui/empty-state";
import { Td, Th } from "@/components/sales/sales-table";
import { Button } from "@/components/ui/button";

export interface ProductRow {
  id: string;
  name: string;
  sku: string;
  image?: string;
  categoryName?: string;
  supplier?: string;
  costPrice: number;
  price: number;
  discountPrice: number | null;
  stock: number;
  minStock: number;
  status: "active" | "draft" | "archived";
  unit: string;
}

export function ProductTable({
  products, canEdit, showMargins, filtered,
}: {
  products: ProductRow[];
  canEdit: boolean;
  showMargins: boolean;
  filtered?: boolean;
}) {
  const { currency } = useStore();
  const router = useRouter();

  if (products.length === 0) {
    return (
      <EmptyState
        icon={filtered ? <Package strokeWidth={1.25} /> : <EmptyBoxMark />}
        title={filtered ? "No products match those filters" : "Your catalogue is empty"}
        description={
          filtered
            ? "Try clearing a filter or searching for something else."
            : "Add your first product and NexaStore will start tracking its margin, stock and sales performance."
        }
        action={!filtered && canEdit ? { label: "Add a product", href: "/products/new" } : undefined}
      />
    );
  }

  return (
    <>
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--line)]">
              <Th className="pl-4 sm:pl-5">Product</Th>
              <Th>Category</Th>
              <Th className="text-right">Cost</Th>
              <Th className="text-right">Price</Th>
              {showMargins ? <Th className="text-right">Margin</Th> : null}
              <Th className="text-right">Stock</Th>
              <Th>Status</Th>
              <Th className="pr-4 sm:pr-5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {products.map((p) => {
              const econ = unitEconomics(p.price, p.costPrice, p.discountPrice);
              const stockStatus = classifyStock(p.stock, p.minStock, null);

              return (
                <tr
                  key={p.id}
                  tabIndex={0}
                  role="link"
                  aria-label={p.name}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("a,button")) return;
                    router.push(`/products/${p.id}`);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") router.push(`/products/${p.id}`);
                  }}
                  className="group hover:bg-[var(--inset)] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ring)]"
                >
                  <Td className="pl-4 sm:pl-5">
                    <span className="flex items-center gap-2.5 min-w-0">
                      <ProductTile name={p.name} sku={p.sku} image={p.image} size={34} />
                      <span className="min-w-0">
                        <Link
                          href={`/products/${p.id}`}
                          className="block text-[13px] font-medium text-ink hover:text-[var(--accent-ink)] transition-colors truncate max-w-[260px]"
                        >
                          {p.name}
                        </Link>
                        <span className="block text-[11px] text-ink-3 font-mono">{p.sku}</span>
                      </span>
                    </span>
                  </Td>

                  <Td>
                    <span className="text-[12.5px] text-ink-2">
                      {p.categoryName ?? <span className="text-ink-3">Uncategorised</span>}
                    </span>
                  </Td>

                  <Td className="text-right">
                    <span className="text-[12.5px] text-ink-3 tnum">{formatMoney(p.costPrice, currency)}</span>
                  </Td>

                  <Td className="text-right">
                    <span className="text-[13px] font-medium text-ink tnum">
                      {formatMoney(econ.effectivePrice, currency)}
                    </span>
                    {econ.isDiscounted ? (
                      <span className="block text-[11px] text-ink-3 line-through tnum">
                        {formatMoney(p.price, currency)}
                      </span>
                    ) : null}
                  </Td>

                  {showMargins ? (
                    <Td className="text-right">
                      <span
                        className={cn(
                          "text-[12.5px] font-medium tnum",
                          econ.marginPct < 0 ? "text-[var(--neg)]" : econ.marginPct >= 30 ? "text-[var(--pos)]" : "text-ink-2",
                        )}
                      >
                        {econ.marginPct.toFixed(0)}%
                      </span>
                      <span className="block text-[11px] text-ink-3 tnum">
                        {formatMoney(econ.profitPerUnit, currency)}
                      </span>
                    </Td>
                  ) : null}

                  <Td className="text-right">
                    <span className="text-[13px] font-medium text-ink tnum">{p.stock}</span>
                    <span className="block text-[11px] text-ink-3 tnum">min {p.minStock}</span>
                  </Td>

                  <Td>
                    <span className="flex flex-col items-start gap-1">
                      <StockStatusBadge status={stockStatus} />
                      {p.status !== "active" ? <ProductStatusBadge status={p.status} /> : null}
                    </span>
                  </Td>

                  <Td className="pr-4 sm:pr-5 text-right">
                    {canEdit ? (
                      <Button asChild variant="ghost" size="iconSm" className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                        <Link href={`/products/${p.id}/edit`} aria-label={`Edit ${p.name}`}>
                          <Pencil />
                        </Link>
                      </Button>
                    ) : null}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="lg:hidden divide-y divide-[var(--line)]">
        {products.map((p) => {
          const econ = unitEconomics(p.price, p.costPrice, p.discountPrice);
          const stockStatus = classifyStock(p.stock, p.minStock, null);
          return (
            <li key={p.id}>
              <Link href={`/products/${p.id}`} className="flex items-start gap-3 px-4 py-3 active:bg-[var(--surface-2)]">
                <ProductTile name={p.name} sku={p.sku} image={p.image} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium text-ink line-clamp-2">{p.name}</p>
                  <p className="text-[11px] text-ink-3 font-mono mt-0.5">{p.sku}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <StockStatusBadge status={stockStatus} />
                    <span className="text-[11.5px] text-ink-3 tnum">{p.stock} in stock</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[14px] font-semibold text-ink tnum">
                    {formatMoney(econ.effectivePrice, currency)}
                  </p>
                  {showMargins ? (
                    <p className="text-[11.5px] text-ink-3 tnum mt-0.5">{econ.marginPct.toFixed(0)}% margin</p>
                  ) : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
