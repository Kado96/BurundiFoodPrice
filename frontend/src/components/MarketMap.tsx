import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { Link } from "@tanstack/react-router";
import type { Market, Province, LatestPrice, Product } from "@/lib/data";
import { fbu, PROVINCE_COLORS } from "@/lib/data";

export default function MarketMap({
  markets, provinces, latest, products, height = 560,
}: { markets: Market[]; provinces: Province[]; latest: LatestPrice[]; products: Product[]; height?: number }) {
  const prov = Object.fromEntries(provinces.map((p) => [p.id, p.name]));
  const prod = Object.fromEntries(products.map((p) => [p.id, p.name]));
  return (
    <MapContainer center={[-3.38, 29.92]} zoom={8} minZoom={7} maxBounds={[[-5, 28.5], [-2, 31.3]]}
      style={{ height, width: "100%" }} className="rounded-lg border">
      <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {markets.filter((m) => m.active).map((m) => {
        const lp = latest.filter((l) => l.market_id === m.id);
        const last = lp.reduce((a, l) => (l.observed_at > a ? l.observed_at : a), "");
        const color = PROVINCE_COLORS[prov[m.province_id] ?? ""] ?? "var(--primary)";
        return (
          <CircleMarker key={m.id} center={[m.lat, m.lng]} radius={10}
            pathOptions={{ color: "white", weight: 2, fillColor: color, fillOpacity: 0.95 }}>
            <Popup>
              <div className="min-w-52">
                <div className="font-display text-base font-bold">{m.name}</div>
                <div className="text-xs opacity-70">{prov[m.province_id]} · {m.commune} · {m.market_days}</div>
                {last && <div className="mt-1 text-xs">MAJ : {new Date(last).toLocaleDateString("fr-FR")}</div>}
                <ul className="mt-2 space-y-0.5 text-xs">
                  {lp.slice(0, 5).map((l) => (
                    <li key={l.product_id} className="flex justify-between gap-3">
                      <span>{prod[l.product_id]}</span><b>{fbu(l.unit_price)}/{l.unit}</b>
                    </li>
                  ))}
                </ul>
                <Link to="/marches/$id" params={{ id: m.id }} className="mt-2 inline-block text-xs font-semibold underline">Voir le marché →</Link>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
