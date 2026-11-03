/**
 * Crée / met à jour photos/catalogs/meta/gallery.json dans le bucket Supabase.
 * sb_secret_ + Authorization JWT anon (Storage exige un Bearer JWT).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadEnv() {
  const out = {};
  for (const file of [path.join(ROOT, "backend", ".env"), path.join(ROOT, ".env")]) {
    try {
      const text = fs.readFileSync(file, "utf8");
      for (const line of text.split(/\r?\n/)) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (!m) continue;
        out[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
      }
    } catch {
      /* skip */
    }
  }
  return out;
}

const env = loadEnv();
const url = (env.SUPABASE_URL || "").replace(/\/$/, "");
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.SUPABASE_ANON_KEY;
if (!url || !serviceKey || !anonKey) {
  console.error("SUPABASE_URL / SERVICE_ROLE / ANON manquants");
  process.exit(1);
}

const OBJECT = "catalogs/meta/gallery.json";
const payload = JSON.stringify(
  { items: [], markets: {}, products: {}, updatedAt: new Date().toISOString() },
  null,
  2,
);

const headers = {
  // JWT valide pour le validateur OpenAPI Storage
  Authorization: `Bearer ${anonKey}`,
  // Privileges service via nouvelle clé
  apikey: serviceKey,
  "Content-Type": "application/json",
  "x-upsert": "true",
};

async function call(pathname, method, body) {
  const res = await fetch(`${url}/storage/v1${pathname}`, {
    method,
    headers,
    body,
  });
  return { ok: res.ok, status: res.status, text: await res.text() };
}

const bucket = await call(
  "/bucket/photos",
  "PUT",
  JSON.stringify({
    public: true,
    file_size_limit: 5242880,
    allowed_mime_types: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/json",
    ],
  }),
);
console.log("[seed] bucket:", bucket.status, bucket.text.slice(0, 160));

let up = await call(`/object/photos/${OBJECT}`, "POST", payload);
if (!up.ok) up = await call(`/object/photos/${OBJECT}`, "PUT", payload);

if (!up.ok) {
  console.error("[seed] upload failed:", up.status, up.text.slice(0, 300));
  process.exit(1);
}

console.log("[seed] OK", `${url}/storage/v1/object/public/photos/${OBJECT}`);
