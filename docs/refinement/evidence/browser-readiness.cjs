/* global __dirname, Buffer */
// Isolated browser readiness probe. Never reads an existing browser profile or app data.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const profile = fs.mkdtempSync(
  path.resolve(__dirname, '../../../.tools/refinement-browser-profile-'),
);
const started = new Date().toISOString();
const software = process.argv.includes('--software');
const reportName = software ? 'browser-software-readiness' : 'browser-readiness';
const report = { started, profile, rendered: false, software, applicationLaunched: false };
const browser = spawn(
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  [
    '--headless',
    ...(software ? ['--disable-gpu'] : []),
    '--disable-background-networking',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { windowsHide: true, stdio: 'ignore' },
);
let socket;
const pending = new Map();
let sequence = 0;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const command = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(Error(`CDP timeout: ${method}`));
    }, 6000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
(async () => {
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 60 && !fs.existsSync(portFile); i++) await delay(500);
  if (!fs.existsSync(portFile)) throw Error('No CDP endpoint after 30 seconds');
  const port = fs.readFileSync(portFile, 'utf8').split('\n')[0];
  const targets = await (
    await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(4000) })
  ).json();
  const target = targets.find((item) => item.type === 'page');
  if (!target) throw Error('No page target');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', ({ data }) => {
    const response = JSON.parse(data);
    const request = pending.get(response.id);
    if (!request) return;
    clearTimeout(request.timeout);
    pending.delete(response.id);
    if (response.error) request.reject(Error(response.error.message));
    else request.resolve(response.result);
  });
  report.version = await command('Browser.getVersion');
  await command('Page.enable');
  await command('Page.navigate', {
    url: 'data:text/html,<title>Lerona isolated readiness probe</title><p>No application data</p>',
  });
  report.page = await command('Runtime.evaluate', {
    expression: 'document.title',
    returnByValue: true,
  });
  const capture = await command('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(__dirname, `${reportName}.png`), Buffer.from(capture.data, 'base64'));
  report.rendered = true;
})()
  .catch((error) => {
    report.error = error.message;
    process.exitCode = 1;
  })
  .finally(() => {
    for (const item of pending.values()) clearTimeout(item.timeout);
    socket?.close();
    browser.kill();
    report.finished = new Date().toISOString();
    fs.writeFileSync(path.join(__dirname, `${reportName}.json`), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  });
