import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import type { ReactNode } from "react";

export function Avail({ v }: { v: string }) {
  const { lang } = useI18n();
  const cls =
    v === "disponible"
      ? "bg-success/15 text-success"
      : v === "faible"
      ? "bg-warning/20 text-accent-foreground"
      : "bg-destructive/15 text-destructive";

  const labels: Record<string, { fr: string; rn: string; en: string }> = {
    disponible: { fr: "Disponible", rn: "Birahari", en: "Available" },
    faible: { fr: "Faible", rn: "Ni bike", en: "Low" },
    rupture: { fr: "Non disponible", rn: "Ntabihari", en: "Unavailable" },
  };

  const label = labels[v] ? labels[v][lang] : v;
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", cls)}>{label}</span>;
}

export function Delta({ v }: { v: number | null }) {
  if (v == null) return <span className="text-muted-foreground">—</span>;
  const up = v > 0.5, down = v < -0.5;
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm font-medium tabular-nums", up ? "text-destructive" : down ? "text-success" : "text-muted-foreground")}>
      <Icon className="h-3.5 w-3.5" />{v > 0 ? "+" : ""}{v.toFixed(1)} %
    </span>
  );
}

export function PageTitle({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
        {sub && <p className="mt-1 text-muted-foreground">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export const Page = ({ children }: { children: ReactNode }) => <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>;
