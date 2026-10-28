import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "fr" | "rn" | "en";

export const dict = {
  // Navigation & General
  home: { fr: "Accueil", rn: "Ahabanza", en: "Home" },
  map: { fr: "Carte", rn: "Ikarata", en: "Map" },
  markets: { fr: "Marchés", rn: "Amasoko", en: "Markets" },
  products: { fr: "Produits", rn: "Ibidandazwa", en: "Products" },
  compare: { fr: "Comparaison", rn: "Kugereranya", en: "Compare" },
  stats: { fr: "Statistiques", rn: "Ibiharuro", en: "Statistics" },
  apiDocs: { fr: "API Ouverte", rn: "API ifunguye", en: "Open API" },
  agent: { fr: "Espace agent", rn: "Umukozi", en: "Agent" },
  admin: { fr: "Administration", rn: "Ubuyobozi", en: "Admin" },
  agentTracking: { fr: "Suivi des agents", rn: "Gukurikirana abakozi", en: "Agent Tracking" },
  login: { fr: "Connexion", rn: "Kwinjira", en: "Sign in" },
  logout: { fr: "Déconnexion", rn: "Gusohoka", en: "Sign out" },
  loading: { fr: "Chargement…", rn: "Birimwo biraza…", en: "Loading…" },
  search: { fr: "Rechercher…", rn: "Rondera…", en: "Search…" },
  allProvinces: { fr: "Toutes les provinces", rn: "Intara zose", en: "All provinces" },
  allProducts: { fr: "Tous les produits", rn: "Ibidandazwa vyose", en: "All products" },
  allMarkets: { fr: "Tous les marchés", rn: "Amasoko yose", en: "All markets" },
  province: { fr: "Province", rn: "Intara", en: "Province" },
  provinces: { fr: "Provinces", rn: "Intara", en: "Provinces" },
  market: { fr: "Marché", rn: "Isoko", en: "Market" },
  price: { fr: "Prix", rn: "Igiciro", en: "Price" },
  currentPrice: { fr: "Prix actuel", rn: "Igiciro ubu", en: "Current price" },
  lastUpdate: { fr: "Dernière mise à jour", rn: "Vyavuguruwe", en: "Last update" },
  availability: { fr: "Disponibilité", rn: "Kuboneka", en: "Availability" },
  variation: { fr: "Variation", rn: "Ihinduka", en: "Change" },
  variation30: { fr: "Variation 30 j", rn: "Ihinduka imisi 30", en: "30-day change" },
  history: { fr: "Évolution des prix", rn: "Ihinduka ry'ibiciro", en: "Price history" },
  viewMarket: { fr: "Voir le marché", rn: "Raba isoko", en: "View market" },
  status: { fr: "Statut", rn: "Uko vyifashe", en: "Status" },
  active: { fr: "Actif", rn: "Arakora", en: "Active" },
  inactive: { fr: "Inactif", rn: "Ntakora", en: "Inactive" },
  validationRate: { fr: "Taux de validation", rn: "Ibiro vyemejwe", en: "Validation rate" },
  totalSubmissions: { fr: "Relevés soumis", rn: "Ibiciro vyatanzwe", en: "Submitted records" },
  lastSubmission: { fr: "Dernier relevé", rn: "Iheruka gutangwa", en: "Last submission" },
  filter: { fr: "Filtrer", rn: "Gutoranya", en: "Filter" },
  save: { fr: "Enregistrer", rn: "Bika", en: "Save" },
  cancel: { fr: "Annuler", rn: "Hagarika", en: "Cancel" },
  fullscreen: { fr: "Plein écran", rn: "Ecran yose", en: "Fullscreen" },
  followProduct: { fr: "Suivre un produit", rn: "Gukurikira igidandazwa", en: "Follow a product" },
  results: { fr: "Résultats", rn: "Ibivuyemwo", en: "Results" },
  noResults: { fr: "Aucun prix trouvé.", rn: "Nta giciro cabonetse.", en: "No price found." },
  recordedOn: { fr: "Relevé le", rn: "Vyafashwe kuwa", en: "Recorded on" },
  allDays: { fr: "Tous les jours", rn: "Imisi yose", en: "Every day" },
  goToPublicWeb: {
    fr: "Accéder à l'observatoire public des prix",
    rn: "Kwinjira ku rubuga rusanzwe rw'ibiciro",
    en: "Access public price observatory",
  },
  mobileAgentNotice: {
    fr: "Espace réservé aux agents de terrain et administrateurs",
    rn: "Ahagenewe abakozi bo mu kibuga n'abakuru gusa",
    en: "Dedicated to field agents and administrators",
  },

  // Administration Tabs & Roles
  dashboardTab: { fr: "Tableau de bord", rn: "Ikibaho nyamukuru", en: "Dashboard" },
  validationTab: { fr: "Validation", rn: "Kwemeza ibiciro", en: "Validation" },
  dataTab: { fr: "Collectes & Données", rn: "Amakuru yegeranijwe", en: "Collections & Data" },
  trackingTab: { fr: "Suivi des agents", rn: "Gukurikirana abakozi", en: "Agent Tracking" },
  usersTab: { fr: "Utilisateurs", rn: "Abakoresha", en: "Users" },
  marketsTab: { fr: "Marchés", rn: "Amasoko", en: "Markets" },
  productsTab: { fr: "Produits", rn: "Ibidandazwa", en: "Products" },
  exportTab: { fr: "Export", rn: "Gusohora amakuru", en: "Export" },
  superAdminRole: { fr: "super administrateur", rn: "umukuru mukuru", en: "super administrator" },
  adminRole: { fr: "administrateur", rn: "umuyobozi", en: "administrator" },
  supervisorRole: { fr: "superviseur", rn: "umugenzuzi", en: "supervisor" },
  connectedAs: { fr: "Connecté en tant que", rn: "Winjiye nka", en: "Logged in as" },
  reservedAccess: { fr: "Accès réservé", rn: "Ahabujijwe", en: "Restricted Access" },
  reservedAccessSub: {
    fr: "Cette page est réservée aux superviseurs et administrateurs.",
    rn: "Uru rupapuro rwagenewe abagenzuzi n'abayobozi gusa.",
    en: "This page is reserved for supervisors and administrators.",
  },
  goToAgentSpace: { fr: "Aller à l'espace agent", rn: "Jya mu kigo c'abakozi", en: "Go to agent portal" },

  // Auth Page & Form
  authTitle: { fr: "Espace de collecte et d'administration", rn: "Ahakorerwa iyegeranya n'ubuyobozi", en: "Data Collection & Administration" },
  authSub: {
    fr: "Réservé aux agents de terrain, superviseurs et administrateurs. Les comptes agents sont créés par l'administration.",
    rn: "Ahagenewe abakozi bo mu kibuga, abagenzuzi n'abayobozi. Konti z'abakozi ziremwa n'ubuyobozi.",
    en: "Reserved for field agents, supervisors and administrators. Agent accounts are provisioned by admin.",
  },
  authOfflineBullet: {
    fr: "Formulaire de collecte guidé, avec GPS et photo, utilisable sans réseau.",
    rn: "Urupapuro rw'iyegeranya buyobowe na GPS n'amafoto, rukora no hatari umuyoboro.",
    en: "Guided collection form with GPS and photo, usable offline.",
  },
  authVerifyBullet: {
    fr: "Chaque prix est vérifié par un superviseur avant publication.",
    rn: "Buri giciro cyemezwa n'umugenzuzi mbere yo gutangazwa.",
    en: "Every price record is verified by a supervisor prior to publication.",
  },
  signInTitle: { fr: "Connexion", rn: "Kwinjira", en: "Sign In" },
  createAccountTitle: { fr: "Créer un compte", rn: "Kurema konti", en: "Create an Account" },
  signInDesc: {
    fr: "Entrez vos identifiants pour accéder à l'espace de collecte ou d'administration.",
    rn: "Injiza ibikuranga kugira winjire mu kigo c'iyegeranya cyangwa ubugenzuzi.",
    en: "Enter your credentials to access the collection or administration space.",
  },
  firstAdminDesc: {
    fr: "Le premier compte créé devient super administrateur.",
    rn: "Konti ya mbere iremwe iba iy'umuyobozi mukuru.",
    en: "The first account created becomes super administrator.",
  },
  usernameLabel: { fr: "Nom d'utilisateur", rn: "Izina ry'umukoresha", en: "Username" },
  usernamePlaceholder: { fr: "Ex: agent1 ou burundifood", rn: "Akarorero: agent1 cyangwa burundifood", en: "E.g. agent1 or burundifood" },
  emailOptionalLabel: { fr: "Adresse e-mail (optionnel)", rn: "Imeli (si ngombwa)", en: "Email address (optional)" },
  emailOptionalPlaceholder: { fr: "Ex: agent1@exemple.com (facultatif)", rn: "Akarorero: agent1@urugero.com", en: "E.g. agent1@example.com (optional)" },
  passwordPinLabel: { fr: "Mot de passe / Code PIN (min. 3 caractères)", rn: "Ijambo ry'ibanga / Code PIN (byibura inyuguti 3)", en: "Password / PIN Code (min. 3 chars)" },
  signInBtn: { fr: "Se connecter", rn: "Injira", en: "Sign in" },
  createAccountBtn: { fr: "Créer le compte", rn: "Rema konti", en: "Create account" },
  pleaseWait: { fr: "Veuillez patienter…", rn: "Rindira gato…", en: "Please wait…" },
  toggleToSignUp: {
    fr: "Premier lancement ? Créer le compte administrateur",
    rn: "Bwa mbere? Rema konti y'umuyobozi",
    en: "First time? Create administrator account",
  },
  toggleToSignIn: { fr: "J'ai déjà un compte", rn: "Mfise konti bisanzwe", en: "Already have an account" },
  publicWebPrompt: {
    fr: "Vous souhaitez simplement consulter les prix du marché ?",
    rn: "Ushaka kuraba gusa ibiciro byo ku masoko?",
    en: "Just looking to browse market food prices?",
  },


  // Jours de la semaine
  monday: { fr: "Lundi", rn: "Kuwa mbere", en: "Monday" },
  tuesday: { fr: "Mardi", rn: "Kuwa kabiri", en: "Tuesday" },
  wednesday: { fr: "Mercredi", rn: "Kuwa gatatu", en: "Wednesday" },
  thursday: { fr: "Jeudi", rn: "Kuwa kane", en: "Thursday" },
  friday: { fr: "Vendredi", rn: "Kuwa gatanu", en: "Friday" },
  saturday: { fr: "Samedi", rn: "Kuwa gatandatu", en: "Saturday" },
  sunday: { fr: "Dimanche", rn: "Kuwa mungu", en: "Sunday" },

  // Page Accueil
  observatory: { fr: "Observatoire des prix", rn: "Indorerwamo y'ibiciro", en: "Price observatory" },
  heroTitle: {
    fr: "Combien coûte aujourd'hui votre panier, marché par marché ?",
    rn: "Ibifungurwa bigura angahe uyu munsi, isoko ku rindi?",
    en: "What does food cost today, market by market?",
  },
  heroSub: {
    fr: "Des prix relevés sur place par nos agents, vérifiés, puis publiés pour chaque marché du Burundi.",
    rn: "Ibiciro vyegeranijwe n'abakozi bacu mu masoko y'u Burundi, bikemezwa.",
    en: "Prices collected on-site by our agents, verified, and published for each market in Burundi.",
  },
  searchPlaceholder: {
    fr: "Produit (ex. Riz, Haricot…)",
    rn: "Igidandazwa (akarorero: Umuceri, Igiharage…)",
    en: "Product (e.g. Rice, Beans…)",
  },
  marketsFollowed: { fr: "Marchés suivis", rn: "Amasoko akurikiranwa", en: "Tracked markets" },
  trackedProducts: { fr: "Produits suivis", rn: "Ibidandazwa bikurikiranwa", en: "Tracked products" },
  nationalAvgPrices: { fr: "Prix moyens nationaux", rn: "Impuzandengo y'igihugu", en: "National average prices" },
  over30Days: { fr: "Sur 30 jours", rn: "Mu misi 30", en: "Over 30 days" },
  avgPrice: { fr: "Prix moyen", rn: "Igiciro mpuzandengo", en: "Average price" },
  productLabel: { fr: "Produit", rn: "Igidandazwa", en: "Product" },

  // Page Produits
  priceTrackingTitle: { fr: "Suivi des prix", rn: "Gukurikirana ibiciro", en: "Price tracking" },
  priceTrackingSub: {
    fr: "Choisissez un produit pour voir son évolution dans les marchés.",
    rn: "Hitamo igidandazwa kugira urabe ihinduka ry'igiciro mu masoko.",
    en: "Choose a product to see price trends across markets.",
  },
  avgPriceCurrent: { fr: "PRIX MOYEN ACTUEL", rn: "IGICIRO MPUZANDENGO UBU", en: "CURRENT AVERAGE PRICE" },
  cheapest: { fr: "LE MOINS CHER", rn: "IKIRI HASI CYANE", en: "LOWEST PRICE" },
  mostExpensive: { fr: "LE PLUS CHER", rn: "IKIRI HEJURU CYANE", en: "HIGHEST PRICE" },
  priceEvolution: { fr: "Évolution du prix", rn: "Ihinduka ry'igiciro", en: "Price evolution" },
  currentPricesByMarket: { fr: "Prix actuels par marché", rn: "Ibiciro biriho isoko ku rindi", en: "Current prices by market" },
  noDataPeriod: { fr: "Pas de données sur cette période.", rn: "Nta makuru ahari muri iki gihe.", en: "No data for this period." },
  days30: { fr: "30 jours", rn: "Imisi 30", en: "30 days" },
  months3: { fr: "3 mois", rn: "Amezi 3", en: "3 months" },
  months6: { fr: "6 mois", rn: "Amezi 6", en: "6 months" },
  year1: { fr: "1 an", rn: "Umwaka 1", en: "1 year" },
  record: { fr: "Relevé", rn: "Igitigiri", en: "Record" },

  // Page Carte
  mapPageTitle: { fr: "Carte des marchés", rn: "Ikarata y'amasoko", en: "Market map" },
  mapPageSub: {
    fr: "Cliquez sur un marché pour afficher ses derniers prix.",
    rn: "Fyonda ku isoko kugira ubone ibiciro biheruka.",
    en: "Click on a market to view its latest prices.",
  },

  // Page Marchés
  marketsListTitle: { fr: "Marchés suivis", rn: "Amasoko akurikiranwa", en: "Tracked markets" },
  marketsListSub: {
    fr: "Cliquez sur un marché pour voir les prix du jour.",
    rn: "Fyonda ku isoko kugira urabe ibiciro vy'uyu munsi.",
    en: "Click on a market to see today's prices.",
  },

  // Page Comparaison
  comparisonTitle: { fr: "Comparaison des marchés", rn: "Kugereranya amasoko", en: "Market comparison" },
  comparisonSub: {
    fr: "Prix actuel d'un produit dans chaque marché et évolution sur 6 mois.",
    rn: "Igiciro kiriho c'igidandazwa ku masoko n'ihinduka mu mezi 6.",
    en: "Current price of a product in each market and 6-month trend.",
  },
  priceGap: { fr: "Écart", rn: "Itandukaniro", en: "Gap" },
  priceGapSub: { fr: "entre le moins cher et le plus cher", rn: "hagati y'ikiri hasi n'ikiri hejuru", en: "between lowest and highest" },
  currentPriceByMarket: { fr: "Prix actuel par marché", rn: "Igiciro kiriho isoko ku rindi", en: "Current price by market" },
  selectMarketsToCompare: { fr: "Sélectionnez jusqu'à 5 marchés à comparer sur le graphique :", rn: "Hitamo amasoko agera kuri 5 yo kugereranya ku gishushanyo:", en: "Select up to 5 markets to compare on the chart:" },
  noDataProduct: { fr: "Aucune donnée pour ce produit.", rn: "Nta makuru ahari kuri iki gidandazwa.", en: "No data for this product." },

  // Page Statistiques
  nationalStatsTitle: { fr: "Statistiques nationales", rn: "Ibiharuro vy'igihugu", en: "National statistics" },
  nationalStatsSub: {
    fr: "Calculées sur les derniers prix validés, comparés à ceux d'il y a environ 30 jours.",
    rn: "Bishingiye ku biciro biheruka kwemezwa, bigereranywa n'ivyo mu misi 30 iheze.",
    en: "Calculated from the latest verified prices, compared to about 30 days ago.",
  },
  nationalIndex30d: { fr: "Indice national (30 j)", rn: "Ikimenyetso c'igihugu (imisi 30)", en: "National index (30 days)" },
  nationalIndexHint: { fr: "variation moyenne de tous les produits", rn: "ihinduka mpuzandengo ry'ibidandazwa vyose", en: "average variation of all products" },
  risingProducts: { fr: "Produits en hausse", rn: "Ibidandazwa vyaduze", en: "Rising products" },
  fallingProducts: { fr: "Produits en baisse", rn: "Ibidandazwa vyamanutse", en: "Falling products" },
  highestIncreases: { fr: "Plus fortes hausses", rn: "Ibiduzwe cane", en: "Highest increases" },
  highestDecreases: { fr: "Plus fortes baisses", rn: "Ibimanutse cane", en: "Highest decreases" },
  provincialAverages: { fr: "Moyennes par province", rn: "Impuzandengo ku ntara", en: "Provincial averages" },

  // Page API Docs
  apiDocsTitle: { fr: "API ouverte", rn: "API ifunguye", en: "Open API" },
  apiDocsSub: {
    fr: "Données libres en JSON, sans clé, accessibles depuis n'importe quel site ou application (CORS ouvert). Prix en francs burundais (FBu).",
    rn: "Amakuru yigenga muri JSON, ata kimenyetso gikenerwa, aboneka ku rubuga urwo arirwo rwose (CORS yuguruye). Ibiciro mu mafaranga y'u Burundi (FBu).",
    en: "Free JSON data, keyless, accessible from any site or app (open CORS). Prices in Burundian Francs (FBu).",
  },
  apiDocsNotice: {
    fr: "Seuls les prix validés par un superviseur sont publiés. Les informations personnelles des agents ne sont jamais diffusées.",
    rn: "Ibiciro vyemejwe n'umukuru w'abakozi gusa nibyo bitangazwa. Amakuru y'umuntu ku giti ciwe ntiyigera atangazwa.",
    en: "Only supervisor-validated prices are published. Personal agent details are never disclosed.",
  },
  epApiDesc: { fr: "Description de l'API", rn: "Ibisobanuro bya API", en: "API Overview" },
  epProvinces: { fr: "Liste des provinces", rn: "Urutonde rw'intara", en: "List of provinces" },
  epMarkets: { fr: "Marchés (nom, province, coordonnées GPS)", rn: "Amasoko (izina, intara, GPS)", en: "Markets (name, province, GPS)" },
  epCategories: { fr: "Catégories de produits", rn: "Ibyiciro by'ibidandazwa", en: "Product categories" },
  epProducts: { fr: "Produits et unités", rn: "Ibidandazwa n'ibipimo", en: "Products and units" },
  epLatestPrices: { fr: "Dernier prix validé par marché et produit", rn: "Ibiciro biheruka kwemezwa ku masoko n'ibidandazwa", en: "Latest verified price by market and product" },
  epPriceHistory: { fr: "Historique journalier d'un produit (1 à 730 jours)", rn: "Amateka y'igiciro ku munsi (imisi 1 gushika 730)", en: "Daily price history for a product (1 to 730 days)" },
  epObservations: { fr: "Tous les relevés validés, filtrables et paginés (max 1000 par page)", rn: "Ibiciro byose byemejwe (gushika ku 1000 ku rupapuro)", en: "All validated observations, filterable and paginated (max 1000 per page)" },
  epStats: { fr: "Chiffres clés", rn: "Ibiharuro nyamukuru", en: "Key figures" },
} as const;

export type TKey = keyof typeof dict;

// Noms traduits des marchés
export const MARKET_TRANSLATIONS: Record<string, { rn: string; en: string }> = {
  "Marché Central de Bujumbura": { rn: "Isoko Nkuru ya Bujumbura", en: "Bujumbura Central Market" },
  "Marché de Bururi": { rn: "Isoko rya Bururi", en: "Bururi Market" },
  "Marché de Cankuzo": { rn: "Isoko rya Cankuzo", en: "Cankuzo Market" },
  "Marché de Cotebu": { rn: "Isoko rya Cotebu", en: "Cotebu Market" },
  "Marché de Gitega": { rn: "Isoko rya Gitega", en: "Gitega Market" },
  "Marché de Kayanza": { rn: "Isoko rya Kayanza", en: "Kayanza Market" },
  "Marché de Kinama": { rn: "Isoko rya Kinama", en: "Kinama Market" },
  "Marché de Kirundo": { rn: "Isoko rya Kirundo", en: "Kirundo Market" },
  "Marché de Makamba": { rn: "Isoko rya Makamba", en: "Makamba Market" },
  "Marché de Muyinga": { rn: "Isoko rya Muyinga", en: "Muyinga Market" },
  "Marché de Ngozi": { rn: "Isoko rya Ngozi", en: "Ngozi Market" },
  "Marché de Rumonge": { rn: "Isoko rya Rumonge", en: "Rumonge Market" },
  "Marché de Rutana": { rn: "Isoko rya Rutana", en: "Rutana Market" },
  "Marché de Ruyigi": { rn: "Isoko rya Ruyigi", en: "Ruyigi Market" },
  "Marché de Cibitoke": { rn: "Isoko rya Cibitoke", en: "Cibitoke Market" },
};

// Noms traduits des produits vivriers
export const PRODUCT_TRANSLATIONS: Record<string, { rn: string; en: string }> = {
  "Arachides": { rn: "Ibinyobwa", en: "Peanuts" },
  "Banane plantain": { rn: "Igitoke", en: "Plantain Banana" },
  "Farine de manioc": { rn: "Ubufu bw'imyumbati", en: "Cassava Flour" },
  "Farine de maïs": { rn: "Ubufu bw'ibigori", en: "Corn Flour" },
  "Haricot jaune": { rn: "Igiharage c'umuhondo", en: "Yellow Beans" },
  "Haricot rouge": { rn: "Igiharage gitukura", en: "Red Beans" },
  "Huile de palme": { rn: "Amamesa", en: "Palm Oil" },
  "Manioc": { rn: "Imyumbati", en: "Cassava" },
  "Maïs": { rn: "Ibigori", en: "Corn / Maize" },
  "Oignon": { rn: "Igitunguru", en: "Onion" },
  "Petits pois": { rn: "Amashaza", en: "Peas" },
  "Pomme de terre": { rn: "Ibirayi", en: "Potatoes" },
  "Riz blanc": { rn: "Umuceri wera", en: "White Rice" },
  "Riz local": { rn: "Umuceri wo mu gihugu", en: "Local Rice" },
  "Sucre": { rn: "Isukari", en: "Sugar" },
  "Tomate": { rn: "Inyanya", en: "Tomato" },
};

export function translateMarketName(name: string, lang: Lang): string {
  if (!name) return "";
  if (lang === "fr") return name;
  const found = MARKET_TRANSLATIONS[name];
  if (found) return found[lang];
  if (name.startsWith("Marché de ")) {
    const city = name.replace("Marché de ", "");
    return lang === "rn" ? `Isoko rya ${city}` : `${city} Market`;
  }
  return name;
}

export function translateProductName(name: string, lang: Lang): string {
  if (!name) return "";
  if (lang === "fr") return name;
  const found = PRODUCT_TRANSLATIONS[name];
  return found ? found[lang] : name;
}

export function translateMarketDays(days: string | null | undefined, lang: Lang): string {
  if (!days) return lang === "rn" ? "Imisi yose" : lang === "en" ? "Every day" : "Tous les jours";
  if (lang === "fr") return days;

  const dayMap: Record<string, { rn: string; en: string }> = {
    "Tous les jours": { rn: "Imisi yose", en: "Every day" },
    "Lundi": { rn: "Kuwa mbere", en: "Monday" },
    "Mardi": { rn: "Kuwa kabiri", en: "Tuesday" },
    "Mercredi": { rn: "Kuwa gatatu", en: "Wednesday" },
    "Jeudi": { rn: "Kuwa kane", en: "Thursday" },
    "Vendredi": { rn: "Kuwa gatanu", en: "Friday" },
    "Samedi": { rn: "Kuwa gatandatu", en: "Saturday" },
    "Dimanche": { rn: "Kuwa mungu", en: "Sunday" },
  };

  let res = days;
  Object.entries(dayMap).forEach(([fr, trans]) => {
    res = res.replaceAll(fr, trans[lang]);
  });
  return res;
}

const Ctx = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: TKey) => string;
  tm: (name: string) => string;
  tp: (name: string) => string;
  td: (days: string | null | undefined) => string;
}>({
  lang: "fr",
  setLang: () => {},
  t: (k) => (dict[k] ? dict[k].fr : (k as string)),
  tm: (n) => n,
  tp: (n) => n,
  td: (d) => d || "",
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr");
  useEffect(() => {
    const s = localStorage.getItem("bfp-lang") as Lang | null;
    if (s && ["fr", "rn", "en"].includes(s)) setLangState(s);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang === "rn" ? "rn" : lang;
  }, [lang]);
  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("bfp-lang", l);
  };
  return (
    <Ctx.Provider
      value={{
        lang,
        setLang,
        t: (k) => (dict[k] ? dict[k][lang] : (k as string)),
        tm: (n) => translateMarketName(n, lang),
        tp: (n) => translateProductName(n, lang),
        td: (d) => translateMarketDays(d, lang),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useI18n = () => useContext(Ctx);
