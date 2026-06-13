import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const main = readFileSync(resolve(root, "frontend", "src", "main.jsx"), "utf8");
const styles = readFileSync(resolve(root, "frontend", "src", "styles.css"), "utf8");
const i18n = readFileSync(resolve(root, "frontend", "src", "i18n.js"), "utf8");

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
  /const \[visibleWeightSeries,\s*setVisibleWeightSeries\]\s*=\s*useState\(\s*\{[\s\S]*?target:\s*false,/.test(main),
  "weight trend target line should be available but hidden by default"
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
  main.includes("function DatePickerField") &&
    main.includes("function DatePickerInput") &&
    main.includes("<DatePickerField") &&
    main.includes("<DatePickerInput") &&
    !main.includes('<input type="date" value={displayRange.start}') &&
    !main.includes('<input type="date" value={displayRange.end}'),
  "date controls should use the custom React picker instead of native range date inputs"
);

assert(
  styles.includes(".date-picker") &&
    styles.includes(".date-picker-trigger") &&
    styles.includes(".date-picker-popover") &&
    styles.includes(".date-picker-grid") &&
    styles.includes(".date-picker-day") &&
    /date-picker-popover\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?right:\s*0;/.test(styles),
  "custom date picker should provide a right-anchored popover calendar"
);

assert(
  main.includes("betweenPointsAvatar") &&
    /className="[^"]*brand-lockup[^"]*"/.test(main) &&
    main.includes('className="brand-logo"') &&
    styles.includes(".brand-lockup") &&
    styles.includes(".brand-logo"),
  "web sidebar should include the shared Between Points logo beside the brand name"
);

assert(
  /<Field\s+t=\{t\}\s+name="sleepHours"[\s\S]*?min="0"[\s\S]*?max="24"/.test(main) &&
    main.includes("function numericBounds(name)") &&
    main.includes('if (name === "sleepHours") return { min: "0", max: "24" };') &&
    main.includes("{...numericBounds(name)}"),
  "sleep hour inputs should set stable 0-24 bounds so 0.1-step browser validation accepts values like 7.00"
);

assert(
  /<input\s+type="number"\s+step="any"\s+min="0"\s+value=\{target\}/.test(main) &&
    /<input\s+name="weightKg"\s+type="number"\s+step="any"\s+min="0"/.test(main) &&
    main.includes("function numericStep(name)") &&
    main.includes('if (name === "weightKg") return "any";') &&
    !main.includes('name === "sleepHours" || name === "weightKg" ? "0.1" : "1"'),
  "weight inputs should accept any numeric decimal instead of triggering browser step mismatch prompts"
);

assert(
  main.includes('localStorage.getItem("betweenPoints.weightUnit")') &&
    main.includes('localStorage.setItem("betweenPoints.weightUnit", weightUnit)') &&
    /<TargetControl[\s\S]*?weightUnit=\{weightUnit\}[\s\S]*?onWeightUnitChange=\{setWeightUnit\}/.test(main) &&
    /function TargetControl\(\{\s*t,\s*user,\s*weightUnit,\s*onWeightUnitChange,\s*onSave\s*\}\)/.test(main) &&
    /<input\s+type="number"\s+step="any"\s+min="0"\s+value=\{target\}[\s\S]*?<select\s+value=\{weightUnit\}[\s\S]*?<button\s+className="ghost"\s+onClick=\{\(\) => onSave\(inputWeightToKg\(target,\s*weightUnit\)\)\}/.test(main),
  "target control should expose a kg/jin system weight-unit selector between target input and save"
);

assert(
  i18n.includes('kg: "公斤"') &&
    i18n.includes('jin: "斤"') &&
    i18n.includes('kg: "kilograms"') &&
    i18n.includes('jin: "catties"') &&
    !i18n.includes('jin: "jin"'),
  "weight unit labels should be localized as Chinese units in zh and natural English units in en"
);

assert(
  main.includes('function kgToDisplayWeight(value, weightUnit)') &&
    main.includes('function inputWeightToKg(value, weightUnit)') &&
    main.includes('function displayWeightUnit(t, weightUnit)') &&
    main.includes('parseImportFile(fileName, fileData, weightUnit = "kg")') &&
    main.includes('JSON.stringify({ fileName, fileData, weightUnit })') &&
    main.includes("api.parseImportFile(excelFile.name, await fileToBase64(excelFile), weightUnit)") &&
    main.includes('formRecord(new FormData(event.currentTarget), weightDraft, weightUnit)') &&
    main.includes('weightKg: inputWeightToKg(weightDraft, weightUnit)') &&
    /<Dashboard[\s\S]*?weightUnit=\{weightUnit\}/.test(main) &&
    /<HistoryView[\s\S]*?weightUnit=\{weightUnit\}/.test(main),
  "visible weight UI should use the selected unit while saving the existing weightKg API field"
);

const gridRule = styles.match(/\.dashboard-grid,\s*\.analysis-grid,\s*\.import-grid\s*\{[\s\S]*?gap:\s*(\d+)px;/);
const importRule = styles.match(/(?:^|\n)\.import-grid\s*\{[\s\S]*?gap:\s*(\d+)px;[\s\S]*?\}/);

assert(gridRule, "shared page grid rule should declare a gap");
assert(importRule, "import-grid should override the shared grid gap");
assert(
  Number(importRule[1]) > Number(gridRule[1]),
  "import page should have more breathing room than the default page grid"
);
