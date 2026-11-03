import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const periodicPath = join(root, 'n8n/workflows/bfp-periodic-reports.json');
const mainPath = join(root, 'n8n/workflows/bfp-monitoring-reporter.json');

const periodic = JSON.parse(readFileSync(periodicPath, 'utf8'));
const main = JSON.parse(readFileSync(mainPath, 'utf8'));

const skip = new Set([
  'Schedule 18h Bujumbura',
  'Build Periodic Reports HTML',
  'Send Periodic Report Email',
  'Send Report Email',
]);

main.nodes = main.nodes.filter((n) => !skip.has(n.name));
for (const k of Object.keys(main.connections || {})) {
  if (skip.has(k)) delete main.connections[k];
}

main.settings = main.settings || {};
main.settings.timezone = 'Africa/Bujumbura';

const codeNode = periodic.nodes.find((n) => n.name === 'Build Periodic Reports HTML');
const schedNode = periodic.nodes.find((n) => n.name === 'Schedule 18h Bujumbura');
const sendNode = periodic.nodes.find((n) => n.name === 'Send Report Email');

if (!codeNode || !schedNode || !sendNode) {
  throw new Error('Missing nodes in periodic workflow');
}

main.nodes.push(
  {
    ...schedNode,
    id: 'sched-daily-18h',
    position: [220, 560],
  },
  {
    ...codeNode,
    id: 'build-periodic-reports',
    position: [480, 560],
  },
  {
    ...sendNode,
    id: 'send-periodic-report',
    name: 'Send Periodic Report Email',
    position: [740, 560],
  },
);

main.connections['Schedule 18h Bujumbura'] = {
  main: [[{ node: 'Build Periodic Reports HTML', type: 'main', index: 0 }]],
};
main.connections['Build Periodic Reports HTML'] = {
  main: [[{ node: 'Send Periodic Report Email', type: 'main', index: 0 }]],
};

writeFileSync(mainPath, JSON.stringify(main, null, 2) + '\n', 'utf8');
console.log('Merged periodic reports into monitoring workflow. nodes=', main.nodes.length);
