import fs from "node:fs";

const p =
  "E:/Application/jarvis-starter-kit/deliverables/automation/n8n-workflows/bfp-monitoring-reporter/workflow.json";
const relayUrl =
  "https://script.google.com/macros/s/AKfycbz7pHhek_WU73YQDjHONgFEH05f9F1RWAQg8_oiTVn4JHjD-aznOKUDd79wQY8npvb0/exec";
const secret = "bfp-gmail-relay-2026";

const wf = JSON.parse(fs.readFileSync(p, "utf8"));

function asHttpMailNode(node) {
  return {
    ...node,
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    credentials: {},
    parameters: {
      method: "POST",
      url: relayUrl,
      sendBody: true,
      specifyBody: "json",
      jsonBody: `={{ JSON.stringify({ secret: '${secret}', to: 'quicksales.bi@gmail.com', subject: $json.subject, html: $json.html }) }}`,
      options: {
        response: {
          response: {
            neverError: true,
          },
        },
      },
    },
  };
}

wf.nodes = wf.nodes.map((n) => {
  if (n.name === "Send Instant Alert Email" || n.name === "Send 4h Report Email") {
    return asHttpMailNode(n);
  }
  return n;
});

fs.writeFileSync(p, JSON.stringify(wf, null, 2) + "\n");
for (const n of wf.nodes) {
  if (n.name.startsWith("Send")) {
    console.log(n.name, n.type, n.parameters.url);
  }
}
