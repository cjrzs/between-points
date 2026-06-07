import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const remotePort = Number(process.env.CDP_PORT || 9224);
const baseUrl = process.env.SMOKE_URL || "http://127.0.0.1:4173";
const root = resolve(process.cwd());
const userDataDir = join(root, ".tmp", "chrome-smoke-profile");
const artifactDir = join(root, "artifacts");

let chrome;

async function main() {
  await rm(userDataDir, { recursive: true, force: true });
  await mkdir(userDataDir, { recursive: true });
  await mkdir(artifactDir, { recursive: true });

  chrome = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${remotePort}`,
    `--user-data-dir=${userDataDir}`,
    baseUrl,
  ], { stdio: "ignore" });

  const page = await connectToPage();
  await page.send("Page.enable");
  await page.send("Runtime.enable");
  await waitFor(page, "document.readyState === 'complete'");

  await waitFor(page, "document.querySelector('.app-shell') && !document.querySelector('.login-page')");
  await waitFor(page, "document.querySelector('.control-panel')");
  await waitFor(page, "document.querySelectorAll('.range-control input[type=\"date\"]').length === 2");
  await waitFor(page, "document.querySelector('.account-chip')?.dataset.auth === 'anonymous'");

  await page.evaluate(`
    (() => document.querySelector('.theme-toggle')?.click())()
  `);
  await waitFor(page, "document.documentElement.dataset.theme === 'light'");

  await page.evaluate(`
    (() => {
      const form = document.querySelector('.control-panel');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    })()
  `);
  await waitFor(page, "document.querySelector('.login-modal')");
  await waitFor(page, "document.querySelector('.login-backdrop')");

  const account = `browser-smoke-${Date.now()}`;
  await page.evaluate(`
    (() => {
      const setNativeValue = (element, value) => {
        const setter = Object.getOwnPropertyDescriptor(element.constructor.prototype, 'value').set;
        setter.call(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const modal = document.querySelector('.login-modal');
      const inputs = modal.querySelectorAll('input');
      setNativeValue(inputs[0], ${JSON.stringify(account)});
      setNativeValue(inputs[1], 'secret-123');
      modal.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    })()
  `);
  await waitFor(page, "!document.querySelector('.login-modal')");
  await waitFor(page, `document.querySelector('.eyebrow')?.textContent.includes(${JSON.stringify(account)})`);
  await waitFor(page, `
    (() => {
      const actions = document.querySelector('.top-actions');
      return actions && !actions.textContent.includes(${JSON.stringify(account)}) && actions.querySelector('button[title]');
    })()
  `);

  await page.evaluate(`
    (() => {
      const setValue = (name, value) => {
        const input = document.querySelector('[name="' + name + '"]');
        const setter = Object.getOwnPropertyDescriptor(input.constructor.prototype, 'value').set;
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      };
      setValue('date', '2026-06-07');
      setValue('weightKg', '72.3');
      setValue('sleepHours', '6.5');
      setValue('exerciseCalories', '280');
      setValue('exerciseName', 'strength');
      setValue('foodText', 'oats eggs beef rice');
      document.querySelector('.control-panel').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    })()
  `);
  await waitFor(page, "document.body.innerText.includes('72.3')");

  await page.evaluate(`
    (async () => {
      const userId = localStorage.getItem('betweenPoints.userId');
      for (const row of [
        { date: '2026-05-01', weightKg: 73.1, sleepHours: 7, exerciseCalories: 100, foodText: 'inside range', note: 'history sort check' },
        { date: '2025-11-01', weightKg: 76.4, sleepHours: 6, exerciseCalories: 80, foodText: 'outside range', note: 'range exclusion check' }
      ]) {
        await fetch('/api/records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, ...row })
        });
      }
      const state = await fetch('/api/state?userId=' + encodeURIComponent(userId)).then((response) => response.json());
      localStorage.setItem('betweenPoints.userId', state.user.id);
      location.reload();
    })()
  `);
  await waitFor(page, "document.querySelector('.control-panel')");
  await waitFor(page, "!document.querySelector('.account-chip') && document.querySelector('.top-actions button[title]')");

  await page.evaluate(`
    (() => {
      const [start, end] = document.querySelectorAll('.range-control input[type="date"]');
      const setNativeValue = (element, value) => {
        const setter = Object.getOwnPropertyDescriptor(element.constructor.prototype, 'value').set;
        setter.call(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      };
      setNativeValue(end, '2026-06-07');
      setNativeValue(start, '2025-01-01');
    })()
  `);
  await waitFor(page, "document.querySelectorAll('.range-control input[type=\"date\"]')[0].value === '2025-12-07'");

  await page.evaluate("document.querySelectorAll('.nav button')[2].click()");
  await waitFor(page, `
    (() => {
      const dates = Array.from(document.querySelectorAll('tbody tr input[name="date"]')).map((input) => input.value);
      return dates[0] === '2026-06-07' && dates.includes('2026-05-01') && !dates.includes('2025-11-01');
    })()
  `);

  await page.evaluate("document.querySelectorAll('.nav button')[3].click()");
  await waitFor(page, "document.querySelector('input[type=\"file\"][accept=\".xlsx\"]')");
  await waitFor(page, "document.querySelector('input[type=\"file\"][accept=\"image/*\"]')");

  await page.evaluate("document.querySelectorAll('.nav button')[0].click()");
  await page.evaluate(`
    (() => {
      const canvas = document.querySelector('canvas');
      const rect = canvas.getBoundingClientRect();
      canvas.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        clientX: rect.left + 42,
        clientY: rect.top + 22,
        pointerType: 'mouse'
      }));
    })()
  `);
  await waitFor(page, "document.querySelector('.chart-tooltip')?.textContent.includes('73.1')");

  await page.evaluate(`
    (() => {
      const button = document.querySelectorAll('.series-toggle')[1];
      if (!button) throw new Error('second series toggle not found');
      button.click();
    })()
  `);
  await waitFor(page, "document.querySelectorAll('.series-toggle')[1]?.getAttribute('aria-pressed') === 'false'");

  await page.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await writeFile(join(artifactDir, "browser-desktop.png"), Buffer.from((await page.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));

  await page.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await page.send("Page.reload", { ignoreCache: true });
  await waitFor(page, "document.querySelector('.control-panel')");
  await writeFile(join(artifactDir, "browser-mobile.png"), Buffer.from((await page.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));

  const summary = await page.evaluate(`
    JSON.stringify({
      title: document.title,
      hasDashboard: Boolean(document.querySelector('.control-panel')),
      hasDateRange: document.querySelectorAll('.range-control input[type="date"]').length,
      theme: document.documentElement.dataset.theme,
      bodyLength: document.body.innerText.length,
      canvasCount: document.querySelectorAll('canvas').length
    })
  `);
  console.log(summary);
}

async function connectToPage() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const pages = await (await fetch(`http://127.0.0.1:${remotePort}/json/list`)).json();
      const target = pages.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
      if (target) return new CdpPage(target.webSocketDebuggerUrl);
    } catch {}
    await delay(500);
  }
  throw new Error("Chrome DevTools endpoint did not become ready");
}

async function waitFor(page, expression) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const result = await page.evaluate(`Boolean(${expression})`);
    if (result === true) return;
    await delay(250);
  }
  const bodyText = await page.evaluate("document.body ? document.body.innerText.slice(0, 1200) : ''").catch(() => "");
  throw new Error(`Timed out waiting for ${expression}\nCurrent body:\n${bodyText}`);
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

class CdpPage {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
    this.socket = new WebSocket(url);
    this.ready = new Promise((resolveReady, rejectReady) => {
      this.socket.addEventListener("open", resolveReady, { once: true });
      this.socket.addEventListener("error", rejectReady, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolveSend, rejectSend } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) rejectSend(new Error(message.error.message));
      else resolveSend(message.result);
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolveSend, rejectSend) => {
      this.pending.set(id, { resolveSend, rejectSend });
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || "Runtime evaluation failed");
    }
    return result.result?.value;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    if (chrome) chrome.kill();
  });
