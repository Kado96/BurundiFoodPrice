import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { Link } from "@tanstack/react-router";
import type { Market, Province, LatestPrice, Product } from "@/lib/data";
import { fbu, PROVINCE_COLORS } from "@/lib/data";

function FitMarkets({ markets }: { markets: Market[] }) {
  const map = useMap();
  useEffect(() => {
    const pts = markets
      .map((m) => [Number(m.lat), Number(m.lng)] as [number, number])
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
    if (pts.length === 0) {
      map.setView([-3.38, 29.92], 8);
      return;
    }
    if (pts.length === 1) {
      map.setView(pts[0], 12);
      return;
    }
    map.fitBounds(pts, { padding: [40, 40], maxZoom: 12 });
  }, [map, markets]);
  return null;
}

export default function MarketMap({
  markets,
  provinces,
  latest,
  products,
  height = 560,
}: {
  markets: Market[];
  provinces: Province[];
  latest: LatestPrice[];
  products: Product[];
  height?: number;
}) {
  const prov = Object.fromEntries(provinces.map((p) => [p.id, p.name]));
  const prod = Object.fromEntries(products.map((p) => [p.id, p.name]));
  const plottable = markets.filter((m) => {
    const lat = Number(m.lat);
    const lng = Number(m.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) && m.active !== false;
  });

  return (
    <MapContainer
      center={[-3.38, 29.92]}
      zoom={8}
      minZoom={7}
      maxBounds={[
        [-5, 28.5],
        [-2, 31.3],
      ]}
      style={{ height, width: "100%" }}
      className="rounded-lg border relative z-0"
    >
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitMarkets markets={plottable} />
      {plottable.map((m) => {
        const lp = latest.filter((l) => l.market_id === m.id);
        const last = lp.reduce((a, l) => (l.observed_at > a ? l.observed_at : a), "");
        const color = PROVINCE_COLORS[prov[m.province_id] ?? ""] ?? "var(--primary)";
        return (
          <CircleMarker
            key={m.id}
            center={[Number(m.lat), Number(m.lng)]}
            radius={10}
            pathOptions={{ color: "white", weight: 2, fillColor: color, fillOpacity: 0.95 }}
          >
            <Popup>
              <div className="min-w-52">
                <div className="font-display text-base font-bold">{m.name.trim()}</div>
                <div className="text-xs opacity-70">
                  {prov[m.province_id]} · {m.commune} · {m.market_days}
                </div>
                {last && (
                  <div className="mt-1 text-xs">
                    MAJ : {new Date(last).toLocaleDateString("fr-FR")}
                  </div>
                )}
                {lp.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Aucun prix validé pour ce marché pour l’instant.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-0.5 text-xs">
                    {lp.slice(0, 5).map((l) => (
                      <li key={l.product_id} className="flex justify-between gap-3">
                        <span>{prod[l.product_id]}</span>
                        <b>
                          {fbu(l.unit_price)}/{l.unit}
                        </b>
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  to="/marches/$id"
                  params={{ id: m.id }}
                  className="mt-2 inline-block text-xs font-semibold underline"
                >
                  Voir le marché →
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
