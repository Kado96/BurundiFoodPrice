import { supabase } from "@/integrations/supabase/client";

export type LocalObs = {
  client_id: string;
  market_id: string; product_id: string; variety: string; quality: string; origin: string; source: string;
  unit: string; quantity: number; price: number; availability: string; comment: string;
  lat: number | null; lng: number | null; gps_accuracy: number | null; distance_m: number | null;
  flags: string[]; photo: string | null; observed_at: string;
  status: "EN_ATTENTE" | "ERREUR"; error?: string;
};

const KEY = "bfp-queue";
export const getQueue = (): LocalObs[] => {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
};
const setQueue = (q: LocalObs[]) => { localStorage.setItem(KEY, JSON.stringify(q)); window.dispatchEvent(new Event("bfp-queue")); };
export const enqueue = (o: LocalObs) => setQueue([...getQueue(), o]);
export const removeFromQueue = (id: string) => setQueue(getQueue().filter((o) => o.client_id !== id));

export async function compressImage(file: File, max = 1280): Promise<string> {
  const img = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = img.width * s; c.height = img.height * s;
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.75);
}

export async function syncQueue(onProgress?: (done: number, total: number) => void) {
  const q = getQueue();
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id ?? null; // mode public : envoi anonyme autorisé
  let done = 0, ok = 0;
  for (const o of q) {
    try {
      let photo_url: string | null = null;
      if (o.photo && uid) {
        const blob = await (await fetch(o.photo)).blob();
        const path = `${uid}/${o.client_id}.jpg`;
        const up = await supabase.storage.from("photos").upload(path, blob, { contentType: "image/jpeg", upsert: true });
        if (up.error) throw up.error;
        photo_url = path;
      }
      const { photo: _p, status: _s, error: _e, ...rest } = o;
      const { error } = await supabase.from("observations").insert({
        ...rest, variety: o.variety || null, quality: o.quality || null, origin: o.origin || null,
        source: o.source || null, comment: o.comment || null, photo_url, agent_id: uid, status: "SYNCHRONISEE",
      });
      if (error && !error.message.includes("duplicate")) throw error;
      removeFromQueue(o.client_id); ok++;
    } catch (e) {
      setQueue(getQueue().map((x) => x.client_id === o.client_id ? { ...x, status: "ERREUR", error: (e as Error).message } : x));
    }
    onProgress?.(++done, q.length);
  }
  return { ok, total: q.length };
}
