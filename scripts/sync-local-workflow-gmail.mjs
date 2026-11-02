import fs from "node:fs";

const p =
  "E:/Application/jarvis-starter-kit/deliverables/automation/n8n-workflows/bfp-monitoring-reporter/workflow.json";
const wf = JSON.parse(fs.readFileSync(p, "utf8"));
const gmailCred = { id: "7ItqIsFw0pojKmYl", name: "Gmail account" };

wf.nodes = wf.nodes.map((n) => {
  if (n.name === "Send Instant Alert Email" || n.name === "Send 4h Report Email") {
    return {
      ...n,
      type: "n8n-nodes-base.gmail",
      typeVersion: 2.1,
      parameters: {
        authentication: "oAuth2",
        resource: "message",
        operation: "send",
        sendTo: "quicksales.bi@gmail.com",
        subject: "={{ $json.subject }}",
        emailType: "html",
        message: "={{ $json.html }}",
        options: {},
      },
      credentials: { gmailOAuth2: gmailCred },
    };
  }
  return n;
});

fs.writeFileSync(p, JSON.stringify(wf, null, 2) + "\n");
for (const n of wf.nodes) {
  if (n.type.includes("gmail")) {
    console.log(n.name, JSON.stringify(n.parameters.subject));
  }
}
