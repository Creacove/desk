import fs from "node:fs";
import http from "node:http";

const appUrl = process.env.DESK_SMOKE_URL ?? "http://127.0.0.1:4173/?fixtures=true&view=labelHQ";
const appOrigin = new URL(appUrl).origin;
const debugHost = process.env.CHROME_DEBUG_HOST ?? "127.0.0.1";
const debugPort = Number(process.env.CHROME_DEBUG_PORT ?? "9222");
const timeoutMs = Number(process.env.DESK_SMOKE_TIMEOUT_MS ?? "20000");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fetchJson(path) {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: debugHost, port: debugPort, path }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        if (response.statusCode && response.statusCode >= 400) {
          reject(new Error(`Chrome debug request failed ${response.statusCode}: ${body}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`Chrome debug response was not JSON: ${body}\n${error instanceof Error ? error.message : String(error)}`));
        }
      });
    });
    request.on("error", reject);
  });
}

async function getWebSocketUrl() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const pages = await fetchJson("/json");
      const page = pages.find((candidate) => candidate.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      // Chrome may still be starting.
    }
    await delay(250);
  }
  throw new Error("Timed out waiting for Chrome remote debugging.");
}

const webSocketUrl = await getWebSocketUrl();
const socket = new WebSocket(webSocketUrl);
let nextId = 0;
const pending = new Map();
const runtimeFailures = [];

socket.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data));
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message ?? JSON.stringify(message.error)));
    else resolve(message.result);
    return;
  }

  if (message.method === "Runtime.exceptionThrown") {
    const details = message.params?.exceptionDetails;
    runtimeFailures.push(details?.exception?.description ?? details?.text ?? "Unknown runtime exception");
  }
  if (message.method === "Runtime.consoleAPICalled" && message.params?.type === "error") {
    runtimeFailures.push(
      message.params.args?.map((arg) => arg.value ?? arg.description ?? JSON.stringify(arg)).join(" ") ?? "Unknown console error",
    );
  }
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", () => reject(new Error("Unable to open Chrome remote debugging websocket.")), { once: true });
});

function command(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "Runtime evaluation failed.");
  return result.result?.value;
}

function includesText(haystack, needle) {
  return String(haystack).toLowerCase().includes(String(needle).toLowerCase());
}

async function assertNoRuntimeFailure(context) {
  if (!runtimeFailures.length) return;
  throw new Error(`Browser runtime failure while ${context}:\n${runtimeFailures.join("\n")}`);
}

async function waitForText(expected) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    await assertNoRuntimeFailure(`waiting for ${expected}`);
    const text = await evaluate("document.body?.innerText ?? ''");
    if (includesText(text, expected)) return text;
    await delay(250);
  }

  const readyState = await evaluate("document.readyState");
  const bodyText = await evaluate("document.body?.innerText ?? ''");
  const bodyHtml = await evaluate("document.documentElement?.outerHTML ?? ''");
  throw new Error([
    `Timed out waiting for production UI text: ${expected}`,
    `URL: ${await evaluate("location.href")}`,
    `readyState: ${readyState}`,
    "Rendered body excerpt:",
    String(bodyText).slice(0, 5000),
    "DOM excerpt:",
    String(bodyHtml).slice(0, 5000),
  ].join("\n\n"));
}

async function clickExact(label) {
  const clicked = await evaluate(`(() => {
    const target = ${JSON.stringify(label)}.trim().toLowerCase();
    const candidates = [...document.querySelectorAll('button, a')];
    const element = candidates.find((candidate) => (candidate.textContent ?? '').trim().toLowerCase() === target);
    if (!element) return false;
    element.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Unable to click production UI control: ${label}`);
  await delay(500);
  await assertNoRuntimeFailure(`after clicking ${label}`);
}

async function navigate(url) {
  await command("Page.navigate", { url });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await assertNoRuntimeFailure(`loading ${url}`);
    const ready = await evaluate("document.readyState === 'complete'");
    if (ready) break;
    await delay(250);
  }
  await delay(750);
  await assertNoRuntimeFailure(`loading ${url}`);
}

await command("Runtime.enable");
await command("Page.enable");
await navigate(appUrl);

let text = await waitForText("Home");
for (const expected of ["Catalog", "Missions"]) {
  if (!includesText(text, expected)) throw new Error(`Production shell did not render expected navigation: ${expected}`);
}

await clickExact("Catalog");
text = await waitForText("Catalog");
if (!includesText(text, "Catalog")) throw new Error("Catalog workspace did not render after real-browser navigation.");

// Manager is intentionally not a permanent rail item. Verify the supported production
// view-entry contract in the same real browser rather than inventing a nav control.
await navigate(`${appOrigin}/?fixtures=true&view=managerOffice`);
text = await waitForText("Manager");
if (!includesText(text, "Manager")) throw new Error("Manager workspace did not render through the supported view entry.");

await navigate(`${appOrigin}/?fixtures=true&view=missionsWorkspace`);
text = await waitForText("Missions");
if (!includesText(text, "Missions")) throw new Error("Missions workspace did not render through the supported view entry.");

await navigate(`${appOrigin}/?fixtures=true&view=artistProfileWorkspace`);
text = await waitForText("Settings");
if (!includesText(text, "Settings")) throw new Error("Settings workspace did not render through the supported view entry.");

await assertNoRuntimeFailure("after completing production-shell smoke navigation");
socket.close();

if (process.env.DESK_SMOKE_OUTPUT) {
  fs.writeFileSync(process.env.DESK_SMOKE_OUTPUT, JSON.stringify({ ok: true, appUrl }, null, 2));
}

console.log("Production Chromium smoke passed.");
