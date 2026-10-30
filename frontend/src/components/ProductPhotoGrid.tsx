/**
 * ProductPhotoGrid — Grille de cartes produits avec photos réelles
 * Affiche les 16 produits suivis avec photo, nom, prix moyen et tendance
 */
import { Link } from "@tanstack/react-router";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { PRODUCT_IMAGES, getProductFallback } from "@/lib/images";
import { fbu } from "@/lib/data";

interface ProductCard {
  id: string;
  name: string;
  avg: number;
  unit: string;
  delta: number | string | null;
}

interface Props {
  products: ProductCard[];
  loading?: boolean;
}

function DeltaBadge({ v }: { v: number | string | null }) {
  if (v === null || v === undefined) return null;
  const num = typeof v === "number" ? v : parseFloat(String(v).replace("%", "").replace("+", ""));
  if (isNaN(num)) return <span className="text-xs text-muted-foreground">{String(v)}</span>;
  if (Math.abs(num) < 0.5)
    return <span className="flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="h-3 w-3" /> Stable</span>;
  if (num > 0)
    return <span className="flex items-center gap-0.5 text-xs font-semibold text-red-500"><TrendingUp className="h-3 w-3" /> +{num.toFixed(1)}%</span>;
  return <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600"><TrendingDown className="h-3 w-3" /> {num.toFixed(1)}%</span>;
}

function SkeletonCard() {
  return (
    <div className="rounded-xl overflow-hidden border bg-card animate-pulse">
      <div className="h-40 bg-muted" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-6 bg-muted rounded w-1/2" />
      </div>
    </div>
  );
}

export function ProductPhotoGrid({ products, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array(8).fill(0).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => {
        const imgUrl = PRODUCT_IMAGES[p.name];
        const fallback = getProductFallback(p.name);
        const deltaNum = typeof p.delta === "number" ? p.delta : parseFloat(String(p.delta ?? "").replace("%", "").replace("+", ""));
        const hasDelta = !isNaN(deltaNum) && isFinite(deltaNum);
        const isUp = hasDelta && deltaNum > 0.5;
        const isDown = hasDelta && deltaNum < -0.5;

        return (
          <Link
            key={p.id}
            to="/produits"
            search={{ product: p.id } as any}
            className="group rounded-xl overflow-hidden border bg-card shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Photo */}
            <div className="relative h-36 md:h-44 overflow-hidden bg-muted">
              <img
                src={imgUrl ?? fallback}
                alt={p.name}
                loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).src = fallback; }}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {/* Badge tendance */}
              {hasDelta && (
                <span className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full shadow ${
                  isUp ? "bg-red-500 text-white" :
                  isDown ? "bg-emerald-500 text-white" :
                  "bg-gray-500/80 text-white"
                }`}>
                  {isUp ? `▲ +${deltaNum.toFixed(1)}%` : isDown ? `▼ ${deltaNum.toFixed(1)}%` : "●"}
                </span>
              )}
            </div>

            {/* Infos */}
            <div className="p-3">
              <p className="text-sm font-semibold leading-tight truncate">{p.name}</p>
              <div className="mt-1.5 flex items-end justify-between gap-1">
                <span className="text-lg font-bold tabular-nums text-primary">
                  {fbu(p.avg)}
                  <span className="text-xs font-normal text-muted-foreground">/{p.unit}</span>
                </span>
                <DeltaBadge v={p.delta} />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
