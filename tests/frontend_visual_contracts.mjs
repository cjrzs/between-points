import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const main = readFileSync(resolve(root, "frontend", "src", "main.jsx"), "utf8");
const styles = readFileSync(resolve(root, "frontend", "src", "styles.css"), "utf8");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  styles.includes("--chart-grid:") && styles.includes("--chart-axis:"),
  "styles.css should define chart theme tokens for grid lines and axis labels"
);

assert(
  main.includes("const CHART_THEMES =") &&
    main.includes("CHART_THEMES.dark") &&
    main.includes("CHART_THEMES.light") &&
    main.includes('axis: "#dce8e4"') &&
    main.includes('axis: "#405052"') &&
    !main.includes("getComputedStyle(document.documentElement)") &&
    !main.includes('ctx.strokeStyle = "rgba(255,255,255,.10)"') &&
    !main.includes('ctx.fillStyle = "rgba(255,255,255,.52)"') &&
    !main.includes('ctx.fillStyle = "rgba(255,255,255,.68)"'),
  "drawLineChart should use explicit dark/light canvas palettes instead of computed CSS colors"
);

assert(
  main.includes('tone: "cyan"') &&
    main.includes('tone: "green"') &&
    main.includes('tone: "amber"') &&
    main.includes('tone: "target"') &&
    !main.includes('color: "var(--cyan)"') &&
    !main.includes('color: "var(--green)"') &&
    !main.includes('color: "var(--amber)"') &&
    !main.includes('color: "var(--target)"') &&
    !main.includes('color: "#39d5ff"') &&
    !main.includes('color: "#68f58b"') &&
    !main.includes('color: "#ffbd4a"') &&
    !main.includes('color: "#ff5c93"'),
  "chart datasets should select semantic tones that resolve through the active canvas palette"
);

assert(
  main.includes("theme={theme}") &&
    /function LineChart\(\{\s*t,\s*theme\s*=/.test(main) &&
    /drawLineChart\(canvasRef\.current,\s*t,\s*labels,\s*datasets,\s*height,\s*theme\)/.test(main) &&
    /function drawLineChart\(canvas,\s*t,\s*labels,\s*datasets,\s*height,\s*theme\)/.test(main) &&
    /useEffect\(\(\) => \{[\s\S]*drawLineChart[\s\S]*\}, \[t, theme, labels, datasets, height\]\);/.test(main),
  "LineChart should redraw when the app theme changes"
);

assert(
  main.includes('window.setTimeout(() => setToast(""),') &&
    main.includes("window.clearTimeout") &&
    main.includes("}, [toast]);"),
  "success toast should auto-dismiss after a short delay"
);

assert(
  styles.includes('input[type="date"]::-webkit-calendar-picker-indicator') &&
    styles.includes(':root[data-theme="light"] input[type="date"]') &&
    styles.includes("data:image/svg+xml") &&
    styles.includes("opacity: 0") &&
    /input\[type="date"\]\s*\{[\s\S]*?position:\s*relative;/.test(styles) &&
    /input\[type="date"\]::-webkit-calendar-picker-indicator\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?right:\s*0;[\s\S]*?width:\s*44px;[\s\S]*?height:\s*100%;/.test(styles),
  "date inputs should align the native picker hit area with the visible calendar icon"
);

assert(
  main.includes("betweenPointsAvatar") &&
    /className="[^"]*brand-lockup[^"]*"/.test(main) &&
    main.includes('className="brand-logo"') &&
    styles.includes(".brand-lockup") &&
    styles.includes(".brand-logo"),
  "web sidebar should include the shared Between Points logo beside the brand name"
);

const gridRule = styles.match(/\.dashboard-grid,\s*\.analysis-grid,\s*\.import-grid\s*\{[\s\S]*?gap:\s*(\d+)px;/);
const importRule = styles.match(/(?:^|\n)\.import-grid\s*\{[\s\S]*?gap:\s*(\d+)px;[\s\S]*?\}/);

assert(gridRule, "shared page grid rule should declare a gap");
assert(importRule, "import-grid should override the shared grid gap");
assert(
  Number(importRule[1]) > Number(gridRule[1]),
  "import page should have more breathing room than the default page grid"
);
