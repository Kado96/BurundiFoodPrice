/**
 * Détection de plateforme mobile (Capacitor Android / iOS ou navigateur mobile)
 */

export function isMobilePlatform(): boolean {
  if (typeof window === "undefined") return false;

  // 1. Détection environnement hybride natif (Capacitor / Cordova)
  const isCapacitorNative = !!(window as any).Capacitor?.isNativePlatform?.();
  if (isCapacitorNative) return true;

  // 2. Détection par User Agent (Android, iPhone, iPad, etc.)
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || "";
  const isMobileUA = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

  // 3. Détection par largeur d'écran tactile
  const isSmallTouchScreen = window.innerWidth <= 768 && ("ontouchstart" in window || navigator.maxTouchPoints > 0);

  return isMobileUA || isSmallTouchScreen;
}

/**
 * Permet à l'utilisateur mobile d'accéder au site public
 * sans être forcé vers la page de login à chaque changement de page.
 */
export function hasOptedForPublicWeb(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem("bfp-public-web-view") === "true";
}

export function setOptedForPublicWeb(opt: boolean) {
  if (typeof window === "undefined") return;
  if (opt) {
    sessionStorage.setItem("bfp-public-web-view", "true");
  } else {
    sessionStorage.removeItem("bfp-public-web-view");
  }
}
