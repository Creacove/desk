import { setTimeout as delay } from "node:timers/promises";

const debugOrigin = process.env.CHROME_DEBUG_ORIGIN || "http://127.0.0.1:9222";
const appUrl = process.env.APP_SMOKE_URL || "http://127.0.0.1:4173";

async function waitForJson(url, attempts = 40) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw lastError ?? new Error(`Could not reach ${url}`);
}

const pages = await waitForJson(`${debugOrigin}/json/list`);
const target = pages.find((page) => page.webSocketDebuggerUrl) ?? pages[0];
if (!target?.webSocketDebuggerUrl) throw new Error("Chrome DevTools page target was not available.");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("Timed out opening Chrome DevTools WebSocket.")), 5_000);
  socket.addEventListener("open", () => {
    clearTimeout(timeout);
    resolve();
  }, { once: true });
  socket.addEventListener("error", () => {
    clearTimeout(timeout);
    reject(new Error("Chrome DevTools WebSocket failed to open."));
  }, { once: true });
});

let sequence = 0;
const pending = new Map();
const exceptions = [];

socket.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data));
  if (message.id) {
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(`${waiter.method}: ${message.error.message}`));
    else waiter.resolve(message.result ?? {});
    return;
  }
  if (message.method === "Runtime.exceptionThrown") {
    const details = message.params?.exceptionDetails ?? {};
    exceptions.push(details.exception?.description || details.text || "Unknown browser runtime exception");
  }
});

function command(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, method });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Browser evaluation failed.");
  }
  return result.result?.value;
}

async function bodyText() {
  return String(await evaluate("document.body?.innerText || ''"));
}

async function clickExact(label) {
  const clicked = await evaluate(`(() => {
    const target = [...document.querySelectorAll('button,a')]
      .find((element) => (element.textContent || '').trim() === ${JSON.stringify(label)});
    if (!target) return false;
    target.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Could not find a visible ${label} navigation control.`);
  await delay(500);
}

await command("Runtime.enable");
await command("Page.enable");
await command("Page.navigate", { url: appUrl });

for (let attempt = 0; attempt < 40; attempt += 1) {
  const ready = await evaluate("document.readyState === 'complete' && document.body && document.body.innerText.length > 0");
  if (ready) break;
  await delay(250);
}
await delay(750);

let text = await bodyText();
for (const expected of ["Music", "Manager", "Missions", "Settings"]) {
  if (!text.includes(expected)) throw new Error(`Production shell did not render expected navigation: ${expected}`);
}

await clickExact("Music");
text = await bodyText();
if (!text.includes("Music")) throw new Error("Music workspace did not render after real-browser navigation.");

await clickExact("Manager");
text = await bodyText();
if (!text.includes("Manager")) throw new Error("Manager workspace did not render after real-browser navigation.");

if (exceptions.length) {
  throw new Error(`Uncaught browser exception(s):\n${exceptions.join("\n---\n")}`);
}

console.log("Real Chromium production-shell smoke passed: app booted and Music/Manager navigation executed without uncaught runtime exceptions.");
socket.close();
