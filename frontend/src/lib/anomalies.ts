/**
 * Module de détection d'anomalies de prix et de cohérence spatiale
 * Burundi Food Price
 */

export interface PriceAnomalyCheck {
  isAnomaly: boolean;
  relativeDeviation: number; // e.g. 0.40 pour +40%
  reason?: string;
  level?: "warning" | "error";
}

export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Calcule l'écart relatif entre le prix soumis et un prix de référence ou moyen.
 * Détecte une anomalie si l'écart relatif est supérieur à 35% (> 0.35).
 */
export function detectPriceAnomaly(
  submittedPrice: number,
  referencePrice: number,
  threshold: number = 0.35
): PriceAnomalyCheck {
  if (!referencePrice || referencePrice <= 0 || !submittedPrice || submittedPrice <= 0) {
    return { isAnomaly: false, relativeDeviation: 0 };
  }

  const deviation = Math.abs(submittedPrice - referencePrice) / referencePrice;

  if (deviation > threshold) {
    const direction = submittedPrice > referencePrice ? "supérieur" : "inférieur";
    const percentage = Math.round(deviation * 100);
    return {
      isAnomaly: true,
      relativeDeviation: deviation,
      level: deviation > 0.7 ? "error" : "warning",
      reason: `Écart anormal de ${percentage}% (${direction} au prix de référence de ${referencePrice} FBu). Seuil autorisé : ${Math.round(threshold * 100)}%`,
    };
  }

  return { isAnomaly: false, relativeDeviation: deviation };
}

/**
 * Calcule la distance en mètres entre deux points GPS (formule de Haversine).
 */
export function calculateGpsDistanceMeters(
  point1: Coordinates,
  point2: Coordinates
): number {
  const R = 6371e3; // Rayon de la Terre en mètres
  const φ1 = (point1.lat * Math.PI) / 180;
  const φ2 = (point2.lat * Math.PI) / 180;
  const Δφ = ((point2.lat - point1.lat) * Math.PI) / 180;
  const Δλ = ((point2.lng - point1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Vérifie si la position d'un relevé est dans le rayon acceptable d'un marché.
 * Alerte si la distance dépasse maxDistanceMeters (par défaut 1500m).
 */
export function checkDistanceAnomaly(
  agentPos: Coordinates | null | undefined,
  marketPos: Coordinates | null | undefined,
  maxDistanceMeters: number = 1500
): { isAnomaly: boolean; distanceMeters: number | null; reason?: string } {
  if (!agentPos || !agentPos.lat || !agentPos.lng) {
    return {
      isAnomaly: true,
      distanceMeters: null,
      reason: "Position GPS de l'agent non disponible lors du relevé",
    };
  }

  if (!marketPos || !marketPos.lat || !marketPos.lng) {
    return {
      isAnomaly: false,
      distanceMeters: null,
      reason: "Coordonnées de référence du marché non configurées",
    };
  }

  const dist = calculateGpsDistanceMeters(agentPos, marketPos);

  if (dist > maxDistanceMeters) {
    return {
      isAnomaly: true,
      distanceMeters: Math.round(dist),
      reason: `Position GPS relevée à ${Math.round(dist)} m du marché (distance max tolérée : ${maxDistanceMeters} m)`,
    };
  }

  return { isAnomaly: false, distanceMeters: Math.round(dist) };
}
