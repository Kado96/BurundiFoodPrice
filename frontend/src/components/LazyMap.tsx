import { lazy, Suspense, type ComponentProps } from "react";
import { ClientOnly } from "@tanstack/react-router";
import type MarketMapType from "./MarketMap";

const MarketMap = lazy(() => import("./MarketMap"));

export function LazyMap(props: ComponentProps<typeof MarketMapType>) {
  const fb = <div style={{ height: props.height ?? 560 }} className="animate-pulse rounded-lg border bg-muted" />;
  return (
    <ClientOnly fallback={fb}>
      <Suspense fallback={fb}><MarketMap {...props} /></Suspense>
    </ClientOnly>
  );
}
