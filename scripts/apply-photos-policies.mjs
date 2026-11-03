/**
 * Applique les policies storage photos catalogue via SQL REST (PostgREST ne suffit pas).
 * Utilise l'API Management si SUPABASE_ACCESS_TOKEN est dispo, sinon affiche le SQL à coller.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.resolve(
  __dirname,
  "../backend/supabase/migrations/20261102120000_photos_catalog_public.sql",
);
const sql = fs.readFileSync(sqlPath, "utf8");

console.log("=== SQL à exécuter dans Supabase → SQL Editor ===\n");
console.log(sql);
console.log("\n=== Fin SQL ===");
console.log("Dashboard: https://supabase.com/dashboard/project/jvjxrknwbnsvgnobbfwa/sql/new");
