import "dotenv/config";
import express from "express";
import cors from "cors";
import adminRoutes from "./routes/admin.js";
import notifyRoutes from "./routes/notify.js";

const required = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
const missing = required.filter((k) => !process.env[k]?.trim());
if (missing.length) {
  console.error(`[bfp-api] Variables manquantes: ${missing.join(", ")}`);
  console.error("[bfp-api] Copiez backend/.env.example → backend/.env puis redémarrez.");
  process.exit(1);
}

const app = express();
const port = Number(process.env.PORT) || 4000;

// Comme Kora Agency : FRONTEND_URL + CORS_ORIGIN (virgules OK)
// Prod Vercel en fallback si les env Render ne sont pas encore renseignées
const allowed = [
  process.env.FRONTEND_URL,
  process.env.CORS_ORIGIN,
  "https://burundi-food-price.vercel.app",
  "http://localhost:3001",
  "http://localhost:3000",
  // Capacitor Android / iOS (WebView)
  "https://localhost",
  "http://localhost",
  "capacitor://localhost",
  "ionic://localhost",
]
  .filter(Boolean)
  .flatMap((v) => String(v).split(","))
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowed.includes("*") || allowed.includes(origin)) {
        return cb(null, true);
      }
      return cb(new Error(`CORS bloqué pour ${origin}`));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));

app.get("/", (_req, res) => {
  res.json({
    name: "Burundi Food Price API",
    status: "ok",
    supabase: process.env.SUPABASE_URL || null,
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.use("/api/admin", adminRoutes);
app.use("/api/notify", notifyRoutes);

app.use((err, _req, res, _next) => {
  console.error("[error]", err);
  res.status(500).json({ error: err.message || "Erreur serveur" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`[bfp-api] listening on 0.0.0.0:${port}`);
  console.log(`[bfp-api] supabase=${process.env.SUPABASE_URL || "(missing)"}`);
});
