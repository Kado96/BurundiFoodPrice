import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Image as ImageIcon, Save, RefreshCw, Smartphone, Globe, Check, AlertCircle } from "lucide-react";
import { useAppBranding, type AppBranding, DEFAULT_BRANDING } from "@/lib/branding";
import { PhotoDropzone } from "@/components/admin/Catalog";
import { Wheat } from "lucide-react";

export function AppBrandingAdmin() {
  const { branding, setBranding, syncToCloud } = useAppBranding();
  const [logoUrl, setLogoUrl] = useState<string>(branding.logoUrl || "");
  const [splashUrl, setSplashUrl] = useState<string>(branding.splashUrl || "");
  const [appName, setAppName] = useState<string>(branding.appName || "Burundi Food Price");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const updated: AppBranding = {
      logoUrl: logoUrl.trim() || null,
      splashUrl: splashUrl.trim() || null,
      appName: appName.trim() || "Burundi Food Price",
    };
    try {
      await syncToCloud(updated);
      setBranding(updated);
      toast.success("Identité visuelle enregistrée et synchronisée avec le Cloud !");
    } catch (err: any) {
      toast.error("Erreur lors de la synchronisation : " + (err.message || "Erreur"));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Voulez-vous vraiment réinitialiser l'identité visuelle par défaut ?")) return;
    setSaving(true);
    try {
      await syncToCloud(DEFAULT_BRANDING);
      setBranding(DEFAULT_BRANDING);
      setLogoUrl("");
      setSplashUrl("");
      setAppName(DEFAULT_BRANDING.appName || "Burundi Food Price");
      toast.success("Identité visuelle réinitialisée par défaut");
    } catch (err: any) {
      toast.error("Erreur : " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Identité Visuelle & Logo
          </h2>
          <p className="text-sm text-muted-foreground">
            Personnalisez le logo de l'en-tête, le splash screen et l'identité mobile de Burundi Food Price.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs sm:text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Réinitialiser par défaut
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs sm:text-sm font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer l'identité visuelle
          </button>
        </div>
      </div>

      {/* Cartes d'aperçu et d'édition */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LOGO DE L'APPLICATION */}
        <div className="rounded-xl border bg-card p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-base">Logo Principal (Web & Mobile)</h3>
            </div>
            <span className="text-xs bg-primary/10 text-primary font-medium px-2 py-0.5 rounded-full">
              Carré 512x512 ou 1024x1024
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            Apparaît dans la barre de navigation du site Web, les entêtes de l'espace agent, et comme icône de l'application mobile.
          </p>

          {/* Prévisualisation */}
          <div className="flex items-center gap-4 p-3 rounded-lg border bg-muted/20">
            <div className="flex flex-col items-center gap-1.5">
              <div className="h-16 w-16 rounded-xl border bg-card grid place-items-center overflow-hidden shadow-xs">
                {logoUrl ? (
                  <img src={logoUrl} alt="Aperçu Logo" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground shadow-xs">
                    <Wheat className="h-6 w-6" />
                  </div>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">Aperçu</span>
            </div>

            <div className="flex-1 space-y-1">
              <p className="text-sm font-semibold">Exemple dans le Header</p>
              <div className="flex items-center gap-2 bg-background p-2 rounded-md border shadow-2xs">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-8 w-8 rounded-lg object-cover shadow-xs" />
                ) : (
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-xs">
                    <Wheat className="h-4 w-4" />
                  </span>
                )}
                <span className="text-sm font-bold">
                  {appName.split(" ")[0]} <span className="text-primary">{appName.split(" ").slice(1).join(" ")}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Saisie URL ou Dropzone */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">
                Importer une image de logo
              </label>
              <PhotoDropzone
                type="branding"
                name="app_logo"
                onUploaded={(url) => setLogoUrl(url)}
                className="w-full"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">
                Ou URL directe de l'image
              </label>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://.../logo.png"
                className="h-9 w-full rounded-md border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* SPLASH SCREEN */}
        <div className="rounded-xl border bg-card p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-base">Écran de Démarrage (Splash Screen)</h3>
            </div>
            <span className="text-xs bg-primary/10 text-primary font-medium px-2 py-0.5 rounded-full">
              Portrait (ex. 1080x1920)
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            Image affichée au lancement de l'application Android avant l'affichage complet de l'interface.
          </p>

          {/* Prévisualisation Mobile Frame */}
          <div className="flex items-center justify-center p-3 rounded-lg border bg-muted/20">
            <div className="relative w-32 h-48 rounded-2xl border-4 border-foreground/20 bg-background overflow-hidden shadow-md flex items-center justify-center">
              {splashUrl ? (
                <img src={splashUrl} alt="Splash Screen" className="h-full w-full object-cover" />
              ) : logoUrl ? (
                <div className="flex flex-col items-center justify-center gap-2 p-2 text-center">
                  <img src={logoUrl} alt="Logo Splash" className="h-10 w-10 object-contain rounded-md" />
                  <span className="text-[9px] font-bold text-foreground/80">{appName}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-1 p-2 text-center">
                  <Wheat className="h-8 w-8 text-primary" />
                  <span className="text-[8px] font-bold text-foreground/80">Burundi Food Price</span>
                </div>
              )}
            </div>
          </div>

          {/* Saisie URL ou Dropzone */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">
                Importer un Splash Screen
              </label>
              <PhotoDropzone
                type="branding"
                name="app_splash"
                onUploaded={(url) => setSplashUrl(url)}
                className="w-full"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground/80 block mb-1">
                Ou URL directe de l'image
              </label>
              <input
                type="url"
                value={splashUrl}
                onChange={(e) => setSplashUrl(e.target.value)}
                placeholder="https://.../splash.png"
                className="h-9 w-full rounded-md border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* PARAMÈTRES GÉNÉRAUX */}
      <div className="rounded-xl border bg-card p-5 space-y-4 shadow-xs">
        <h3 className="font-semibold text-base">Nom de la Plateforme</h3>
        <div className="max-w-md space-y-2">
          <input
            type="text"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            placeholder="Burundi Food Price"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
          />
          <p className="text-xs text-muted-foreground">
            Nom affiché dans le titre du site Web et en en-tête.
          </p>
        </div>
      </div>

      {/* Note d'information Capacitor & Synchronisation */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground space-y-2">
        <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
          <AlertCircle className="h-4 w-4 text-primary" />
          Synchronisation Web et Application Mobile
        </div>
        <p>
          • <strong>Web & PWA :</strong> Les modifications de logo prennent effet immédiatement sur tous les navigateurs dès l'enregistrement.
        </p>
        <p>
          • <strong>Application Mobile Android :</strong> Les fichiers ressources mobiles se trouvent dans <code>frontend/resources/icon.png</code> et <code>frontend/resources/splash.png</code>. La recompilation Capacitor génère l'APK autonome mis à jour pour le terrain.
        </p>
      </div>
    </div>
  );
}
export default AppBrandingAdmin;
