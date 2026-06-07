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
  await waitForText(page, "落点之间");
  await waitForText(page, "密码");

  const account = `browser-smoke-${Date.now()}`;
  await page.evaluate(`
    (() => {
      const setNativeValue = (element, value) => {
        const setter = Object.getOwnPropertyDescriptor(element.constructor.prototype, 'value').set;
        setter.call(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const inputs = document.querySelectorAll('input');
      setNativeValue(inputs[0], ${JSON.stringify(account)});
      setNativeValue(inputs[1], 'secret-123');
      document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    })()
  `);
  await waitForText(page, "每日打卡");
  await waitForText(page, "显示至");
  await assertBodyIncludes(page, ["睡眠 (h)", "运动消耗 (kcal)"]);
  await assertBodyExcludes(page, ["运动时长", "摄入热量", "蛋白质", "脂肪", "高盐", "高碳水", "外食", "熬夜", "压力大"]);
  await assertBodyIncludes(page, ["每日体重", "7 日均线", "14 日均线", "目标线"]);

  await page.evaluate(`
    (async () => {
      const setValue = (name, value) => {
        const input = document.querySelector('[name="' + name + '"]');
        if (!input) return;
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
      await new Promise((resolve) => setTimeout(resolve, 300));
      document.querySelector('.control-panel').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    })()
  `);
  await waitForText(page, "已保存");
  await waitForText(page, "短期预测");

  await page.evaluate(`
    (async () => {
      const userId = localStorage.getItem('betweenPoints.userId');
      await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          date: '2026-05-01',
          weightKg: 73.1,
          sleepHours: 7,
          exerciseCalories: 100,
          foodText: 'older row',
          note: 'history sort check'
        })
      });
      const state = await fetch('/api/state?userId=' + encodeURIComponent(userId)).then((response) => response.json());
      localStorage.setItem('betweenPoints.userId', state.user.id);
      location.reload();
    })()
  `);
  await waitForText(page, "每日打卡");

  for (const label of ["分析", "历史", "导入", "首页"]) {
    await page.evaluate(`
      (() => {
        const button = Array.from(document.querySelectorAll('button')).find((item) => item.textContent.includes(${JSON.stringify(label)}));
        if (button) button.click();
      })()
    `);
    await waitForText(page, label === "首页" ? "每日打卡" : label);
    if (label === "历史") {
      await waitFor(page, "document.querySelector('tbody tr input[name=\"date\"]')?.value === '2026-06-07'");
    }
    if (label === "导入") {
      await assertBodyIncludes(page, ["下载示例文件", "上传 Excel", "解析图片"]);
      await assertBodyExcludes(page, ["粘贴 CSV", "填入示例"]);
    }
  }

  await page.evaluate(`
    (() => {
      const canvas = document.querySelector('canvas');
      const rect = canvas.getBoundingClientRect();
      const event = new PointerEvent('pointermove', {
        bubbles: true,
        clientX: rect.left + 42,
        clientY: rect.top + 22,
        pointerType: 'mouse'
      });
      canvas.dispatchEvent(event);
    })()
  `);
  await waitFor(page, "document.querySelector('.chart-tooltip')?.textContent.includes('73.1')");

  await page.evaluate(`
    (() => {
      const button = Array.from(document.querySelectorAll('button')).find((item) => item.textContent.includes('7 日均线'));
      if (!button) throw new Error('7 日均线 toggle not found');
      button.click();
    })()
  `);
  await waitFor(page, "Array.from(document.querySelectorAll('button')).find((item) => item.textContent.includes('7 日均线'))?.getAttribute('aria-pressed') === 'false'");

  await page.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await writeFile(join(artifactDir, "browser-desktop.png"), Buffer.from((await page.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));

  await page.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await page.send("Page.reload", { ignoreCache: true });
  await waitForText(page, "每日打卡");
  await writeFile(join(artifactDir, "browser-mobile.png"), Buffer.from((await page.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));

  const summary = await page.evaluate(`
    JSON.stringify({
      title: document.title,
      hasDashboard: document.body.innerText.includes('每日打卡'),
      hasPrediction: document.body.innerText.includes('短期预测'),
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

async function waitForText(page, text) {
  await waitFor(page, `document.body && document.body.innerText.includes(${JSON.stringify(text)})`);
}

async function assertBodyIncludes(page, texts) {
  const bodyText = await page.evaluate("document.body.innerText");
  for (const text of texts) {
    if (!bodyText.includes(text)) {
      throw new Error(`Expected page to include ${text}\\nCurrent body:\\n${bodyText.slice(0, 1200)}`);
    }
  }
}

async function assertBodyExcludes(page, texts) {
  const bodyText = await page.evaluate("document.body.innerText");
  for (const text of texts) {
    if (bodyText.includes(text)) {
      throw new Error(`Expected page not to include ${text}\\nCurrent body:\\n${bodyText.slice(0, 1200)}`);
    }
  }
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
