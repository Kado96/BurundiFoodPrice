/**
 * Génère n8n/workflows/bfp-periodic-reports.json
 * Rapport quotidien 18h Bujumbura + mensuel/trimestriel/annuel (fins de période).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "n8n", "workflows", "bfp-periodic-reports.json");

const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2anhya253Ym5zdmdub2JiZndhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNjgxMzksImV4cCI6MjEwNzc0NDEzOX0.6BU65OVL_jcuc29NnWcQ7WiT53txB5aES8aFY4Z8ong";
const RELAY =
  "https://script.google.com/macros/s/AKfycbz7pHhek_WU73YQDjHONgFEH05f9F1RWAQg8_oiTVn4JHjD-aznOKUDd79wQY8npvb0/exec";

const buildReportCode = fs
  .readFileSync(path.join(ROOT, "n8n", "_build_periodic_report.js"), "utf8")
  // Strip the header comment block only — keep runtime code for n8n
  .replace(/^\/\*\*[\s\S]*?\*\/\s*/, "");

const workflow = {
  name: "Burundi Food Price - Rapports périodiques (18h)",
  nodes: [
    {
      parameters: {
        rule: {
          interval: [
            {
              field: "cronExpression",
              expression: "0 18 * * *",
            },
          ],
        },
      },
      id: "sched-daily-18h",
      name: "Schedule 18h Bujumbura",
      type: "n8n-nodes-base.scheduleTrigger",
      typeVersion: 1.2,
      position: [220, 300],
      notes: "Tous les jours à 18:00 Africa/Bujumbura",
    },
    {
      parameters: {
        jsCode: buildReportCode,
      },
      id: "build-reports",
      name: "Build Periodic Reports HTML",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [480, 300],
    },
    {
      parameters: {
        method: "POST",
        url: RELAY,
        sendBody: true,
        specifyBody: "json",
        jsonBody:
          "={{ JSON.stringify({ secret: 'bfp-gmail-relay-2026', to: 'quicksales.bi@gmail.com', subject: $json.subject, html: $json.html }) }}",
        options: { response: { response: { neverError: true } } },
      },
      id: "send-report-email",
      name: "Send Report Email",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [740, 300],
    },
  ],
  connections: {
    "Schedule 18h Bujumbura": {
      main: [[{ node: "Build Periodic Reports HTML", type: "main", index: 0 }]],
    },
    "Build Periodic Reports HTML": {
      main: [[{ node: "Send Report Email", type: "main", index: 0 }]],
    },
  },
  settings: {
    executionOrder: "v1",
    timezone: "Africa/Bujumbura",
    saveManualExecutions: true,
  },
  staticData: null,
  meta: { templateCredsSetupCompleted: true },
  pinData: {},
};

// Note: ANON constant is embedded in buildReportCode already
void ANON;

fs.writeFileSync(OUT, JSON.stringify(workflow, null, 2) + "\n", "utf8");
console.log("Wrote", OUT);
console.log("Code length:", buildReportCode.length);
