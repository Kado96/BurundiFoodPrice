/**
 * Registre centralisé des images — Burundi Food Price
 * Les URLs Unsplash sont chargées directement par le navigateur.
 * Pour l'Android offline → fallback sur le gradient SVG local.
 */

export const PRODUCT_IMAGES: Record<string, string> = {
  "Riz local":         "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80",
  "Maïs grain":        "https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=400&q=80",
  "Sorgho":            "https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=400&q=80",
  "Haricot jaune":     "https://images.unsplash.com/photo-1596797882870-8c33deeac224?auto=format&fit=crop&w=400&q=80",
  "Petits pois secs":  "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=400&q=80",
  "Arachides":         "https://images.unsplash.com/photo-1567892328127-d0e5ea75d862?auto=format&fit=crop&w=400&q=80",
  "Farine de manioc":  "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=400&q=80",
  "Pomme de terre":    "https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=400&q=80",
  "Patate douce":      "https://images.unsplash.com/photo-1596097635121-14b63b7a0c19?auto=format&fit=crop&w=400&q=80",
  "Banane plantain":   "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=400&q=80",
  "Tomates":           "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=400&q=80",
  "Oignons":           "https://images.unsplash.com/photo-1587049352851-8d4e89133924?auto=format&fit=crop&w=400&q=80",
  "Huile de palme":    "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=400&q=80",
  "Viande de bœuf":   "https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=400&q=80",
  "Ndagala séché":     "https://images.unsplash.com/photo-1534948216015-843149f72be3?auto=format&fit=crop&w=400&q=80",
  "Sucre":             "https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=400&q=80",
};

export interface MarketSlide {
  name: string;
  province: string;
  caption: string;
  image: string;
}

export const MARKET_SLIDES: MarketSlide[] = [
  {
    name: "Marché Central de Bujumbura",
    province: "Bujumbura Mairie",
    caption: "Le plus grand marché vivrier du Burundi — étals colorés, haricots, riz et légumes frais",
    image: "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?auto=format&fit=crop&w=1400&q=85",
  },
  {
    name: "Marché de Cotebu",
    province: "Bujumbura Mairie",
    caption: "Grand marché de gros de Bujumbura — farine, maïs et huile de palme",
    image: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1400&q=85",
  },
  {
    name: "Marché de Gitega",
    province: "Gitega",
    caption: "Carrefour stratégique des hauts plateaux — centre de la nouvelle capitale",
    image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1400&q=85",
  },
  {
    name: "Marché de Ngozi",
    province: "Ngozi",
    caption: "Grand pôle agricole du Nord — sorgho, arachides et tubercules",
    image: "https://images.unsplash.com/photo-1516594798947-e65505dbb29d?auto=format&fit=crop&w=1400&q=85",
  },
  {
    name: "Marché de Rumonge",
    province: "Rumonge",
    caption: "Marché lacustre du Tanganyika — poissons Ndagala, huile de palme et bananes",
    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1400&q=85",
  },
];

/** Fallback SVG coloré si l'image ne charge pas (mode offline Android) */
export function getProductFallback(name: string): string {
  const colors: Record<string, string> = {
    "Riz local": "#e8d5a3", "Maïs grain": "#f5c518", "Sorgho": "#c8a060",
    "Haricot jaune": "#d4a843", "Petits pois secs": "#7eb87e", "Arachides": "#c8956c",
    "Farine de manioc": "#f0e6cc", "Pomme de terre": "#c4a97d", "Patate douce": "#e07b39",
    "Banane plantain": "#f0d060", "Tomates": "#e8402a", "Oignons": "#c890c0",
    "Huile de palme": "#e8a020", "Viande de bœuf": "#8b3a3a", "Ndagala séché": "#6090b0",
    "Sucre": "#f8f0e0",
  };
  const bg = colors[name] ?? "#4caf50";
  const letter = name.charAt(0).toUpperCase();
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="${encodeURIComponent(bg)}"/><text x="200" y="170" font-size="100" font-family="sans-serif" text-anchor="middle" fill="white" opacity="0.7">${letter}</text></svg>`;
}
