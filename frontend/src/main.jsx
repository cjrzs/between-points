import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BarChart3, Calendar, ChevronLeft, ChevronRight, Database, Download, History, Languages, LogIn, LogOut, Moon, Save, Sun, Trash2, Upload, Gauge } from "lucide-react";
import betweenPointsAvatar from "./assets/between-points-avatar.png";
import { getDisplayRange, today } from "./dateRange.js";
import { dictionaries } from "./i18n.js";
import "./styles.css";

const api = {
  async request(path, options = {}) {
    const token = localStorage.getItem("betweenPoints.sessionToken");
    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "apiError");
    return payload;
  },
  login(account, password) {
    return this.request("/api/login", { method: "POST", body: JSON.stringify({ account, password }) });
  },
  state(userId) {
    return this.request(userId ? `/api/state?userId=${encodeURIComponent(userId)}` : "/api/state");
  },
  updateUser(body) {
    return this.request("/api/user", { method: "PATCH", body: JSON.stringify(body) });
  },
  saveRecord(body) {
    return this.request("/api/records", { method: "POST", body: JSON.stringify(body) });
  },
  deleteRecord(userId, date) {
    return this.request(`/api/records?userId=${encodeURIComponent(userId)}&date=${encodeURIComponent(date)}`, { method: "DELETE" });
  },
  parseImportFile(fileName, fileData, weightUnit = "kg") {
    return this.request("/api/import/parse", { method: "POST", body: JSON.stringify({ fileName, fileData, weightUnit }) });
  },
  parseImage(mimeType, imageData) {
    return this.request("/api/import/image", { method: "POST", body: JSON.stringify({ mimeType, imageData }) });
  },
  confirmImport(userId, rows) {
    return this.request("/api/import/confirm", { method: "POST", body: JSON.stringify({ userId, rows }) });
  }
};

const initialData = {
  user: null,
  records: [],
  chartSeries: { dates: [], weights: [], ma7: [], ma14: [], exerciseCalories: [], sleepHours: [] },
  goalProgress: {},
  predictions: [],
  analysis: {}
};

const CHART_THEMES = {
  dark: {
    grid: "rgba(238, 247, 244, 0.16)",
    axis: "#dce8e4",
    empty: "#dce8e4",
    series: {
      cyan: "#39d5ff",
      green: "#68f58b",
      amber: "#ffbd4a",
      target: "#ff5c93",
    },
  },
  light: {
    grid: "rgba(21, 35, 38, 0.16)",
    axis: "#405052",
    empty: "#405052",
    series: {
      cyan: "#087ea4",
      green: "#168b55",
      amber: "#b56e00",
      target: "#b51655",
    },
  },
};

function savedWeightUnit() {
  return normalizeWeightUnit(localStorage.getItem("betweenPoints.weightUnit"));
}

function anonymousData(language) {
  return {
    ...initialData,
    user: {
      id: "",
      account: "Guest",
      language,
      targetWeightKg: 68,
    },
  };
}

function App() {
  const [data, setData] = useState(initialData);
  const [route, setRoute] = useState("dashboard");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [draftRows, setDraftRows] = useState([]);
  const [displayRangeDraft, setDisplayRangeDraft] = useState({ start: "", end: "" });
  const [loginOpen, setLoginOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem("betweenPoints.theme") || "dark");
  const [weightUnit, setWeightUnit] = useState(savedWeightUnit);
  const language = data.user?.language || localStorage.getItem("betweenPoints.lang") || browserLanguage();
  const t = (key) => (dictionaries[language] || dictionaries.zh)[key] || key;
  const viewData = useMemo(() => data.user ? data : anonymousData(language), [data, language]);
  const displayRange = useMemo(() => getDisplayRange(displayRangeDraft), [displayRangeDraft]);
  const displayData = useMemo(() => applyDisplayRange(viewData, displayRange), [viewData, displayRange]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("betweenPoints.theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("betweenPoints.weightUnit", weightUnit);
  }, [weightUnit]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const userId = localStorage.getItem("betweenPoints.userId");
    const sessionToken = localStorage.getItem("betweenPoints.sessionToken");
    if (!userId && !sessionToken) return;
    api.state(userId)
      .then((payload) => applyServerState(payload, setData))
      .catch(() => {
        localStorage.removeItem("betweenPoints.userId");
        localStorage.removeItem("betweenPoints.sessionToken");
        localStorage.removeItem("betweenPoints.sessionExpiresAt");
      });
  }, []);

  async function run(action, toastKey = "") {
    setError("");
    setToast("");
    try {
      await action();
      if (toastKey) setToast(t(toastKey));
    } catch (err) {
      setError(err.message === "apiError" ? t("apiError") : err.message);
    }
  }

  function protectedRun(action, toastKey = "") {
    if (!data.user) {
      setLoginOpen(true);
      return;
    }
    run(action, toastKey);
  }

  const routeTitle = route === "import" ? "importData" : route;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand brand-lockup">
          <img className="brand-logo" src={betweenPointsAvatar} alt="" aria-hidden="true" />
          <div>
            <strong>{t("appName")}</strong>
            <span>{t("appSubtitle")}</span>
          </div>
        </div>
        <nav className="nav">
          <NavButton active={route === "dashboard"} onClick={() => setRoute("dashboard")} icon={<Gauge size={17} />} label={t("dashboard")} />
          <NavButton active={route === "analysis"} onClick={() => setRoute("analysis")} icon={<BarChart3 size={17} />} label={t("analysis")} />
          <NavButton active={route === "history"} onClick={() => setRoute("history")} icon={<History size={17} />} label={t("history")} />
          <NavButton active={route === "import"} onClick={() => setRoute("import")} icon={<Upload size={17} />} label={t("importData")} />
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">{data.user ? data.user.account : t("guest")}</p>
            <h1>{t(routeTitle)}</h1>
          </div>
          <div className="top-actions">
            <label className="compact">
              <span><Languages size={14} /> {t("language")}</span>
              <select
                value={language}
                onChange={(event) => {
                  const nextLanguage = event.target.value;
                  if (!data.user) {
                    localStorage.setItem("betweenPoints.lang", nextLanguage);
                    setData((current) => ({ ...current }));
                    return;
                  }
                  run(async () => applyServerState(await api.updateUser({ userId: data.user.id, language: nextLanguage }), setData));
                }}
              >
                <option value="zh">中文</option>
                <option value="en">English</option>
              </select>
            </label>
            <TargetControl
              t={t}
              user={displayData.user}
              weightUnit={weightUnit}
              onWeightUnitChange={setWeightUnit}
              onSave={(targetWeightKg) => protectedRun(async () => applyServerState(await api.updateUser({ userId: data.user.id, targetWeightKg }), setData), "dataReady")}
            />
            <div className="range-control">
              <DatePickerField
                t={t}
                language={language}
                label="rangeStart"
                value={displayRange.start}
                onChange={(value) => setDisplayRangeDraft((current) => ({ ...current, start: value }))}
                testId="range-start"
              />
              <DatePickerField
                t={t}
                language={language}
                label="rangeEnd"
                value={displayRange.end}
                onChange={(value) => setDisplayRangeDraft((current) => ({ ...current, end: value }))}
                testId="range-end"
              />
            </div>
            <button className="icon-button theme-toggle" title={t("theme")} onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {data.user ? (
              <button className="icon-button" title={t("logout")} onClick={() => {
                localStorage.removeItem("betweenPoints.userId");
                localStorage.removeItem("betweenPoints.sessionToken");
                localStorage.removeItem("betweenPoints.sessionExpiresAt");
                setData(initialData);
              }}>
                <LogOut size={18} />
              </button>
            ) : (
              <button className="account-chip" data-auth="anonymous" onClick={() => setLoginOpen(true)}>
                <LogIn size={17} />{t("loginAction")}
              </button>
            )}
          </div>
        </header>
        {toast && <p className="toast">{toast}</p>}
        {error && <p className="error">{error}</p>}
        {route === "dashboard" && <Dashboard data={displayData} t={t} language={language} theme={theme} weightUnit={weightUnit} protectedRun={protectedRun} setData={setData} displayRange={displayRange} />}
        {route === "analysis" && <Analysis data={displayData} t={t} theme={theme} weightUnit={weightUnit} />}
        {route === "history" && <HistoryView data={displayData} t={t} language={language} weightUnit={weightUnit} filter={filter} setFilter={setFilter} protectedRun={protectedRun} setData={setData} />}
        {route === "import" && <ImportView data={displayData} t={t} language={language} weightUnit={weightUnit} draftRows={draftRows} setDraftRows={setDraftRows} protectedRun={protectedRun} setData={setData} />}
        {loginOpen && <LoginView t={t} error={error} onCancel={() => setLoginOpen(false)} onLogin={(account, password) => run(async () => {
          applyServerState(await api.login(account, password), setData);
          setLoginOpen(false);
        })} />}
      </main>
    </div>
  );
}

function LoginView({ t, error, onLogin, onCancel }) {
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div className="login-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <section className="login-panel login-modal">
        <div className="brand-block">
          <span className="brand-kicker">{t("appSubtitle")}</span>
          <h1>{t("appName")}</h1>
          <p>{t("loginHint")}</p>
        </div>
        <form className="login-form" onSubmit={(event) => {
          event.preventDefault();
          onLogin(account, password);
        }}>
          <label>{t("account")}<input autoComplete="username" required value={account} onChange={(event) => setAccount(event.target.value)} /></label>
          <label>{t("password")}<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button className="primary" type="submit">{t("login")}</button>
          <button className="ghost" type="button" onClick={onCancel}>{t("cancel")}</button>
          {error && <p className="error">{error}</p>}
        </form>
      </section>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }) {
  return <button className={active ? "active" : ""} onClick={onClick}>{icon}<span>{label}</span></button>;
}

function TargetControl({ t, user, weightUnit, onWeightUnitChange, onSave }) {
  const [target, setTarget] = useState(displayWeightValue(user.targetWeightKg ?? 68, weightUnit));
  useEffect(() => setTarget(displayWeightValue(user.targetWeightKg ?? 68, weightUnit)), [user.targetWeightKg, weightUnit]);
  return (
    <>
      <label className="compact">
        <span>{t("targetWeight")} ({displayWeightUnit(t, weightUnit)})</span>
        <input type="number" step="any" min="0" value={target} onChange={(event) => setTarget(event.target.value)} />
      </label>
      <label className="compact">
        <span>{t("weightUnit")}</span>
        <select value={weightUnit} onChange={(event) => onWeightUnitChange(normalizeWeightUnit(event.target.value))}>
          <option value="kg">{t("kg")}</option>
          <option value="jin">{t("jin")}</option>
        </select>
      </label>
      <button className="ghost" onClick={() => onSave(inputWeightToKg(target, weightUnit))}>{t("saveTarget")}</button>
    </>
  );
}

function DatePickerField({ t, language, label, name, value, defaultValue, onChange, testId }) {
  return (
    <label className="date-picker-field">
      <span>{t(label)}</span>
      <DatePickerInput
        t={t}
        language={language}
        ariaLabel={t(label)}
        name={name}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        testId={testId || name}
      />
    </label>
  );
}

function DatePickerInput({ t, language, ariaLabel, name, value, defaultValue, onChange, testId }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [innerValue, setInnerValue] = useState(normalizeDateValue(defaultValue || today()));
  const selectedValue = normalizeDateValue(value ?? innerValue);
  const [calendarMonth, setCalendarMonth] = useState(monthValueForDate(selectedValue));
  const weekdays = weekdayLabels(language);
  const days = calendarDays(calendarMonth);

  useEffect(() => {
    if (value === undefined && defaultValue) setInnerValue(normalizeDateValue(defaultValue));
  }, [defaultValue, value]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function openPicker() {
    setCalendarMonth(monthValueForDate(selectedValue));
    setOpen((current) => !current);
  }

  function commitDate(nextValue) {
    const nextDate = normalizeDateValue(nextValue);
    if (value === undefined) setInnerValue(nextDate);
    onChange?.(nextDate);
    setCalendarMonth(monthValueForDate(nextDate));
    setOpen(false);
  }

  return (
    <div className="date-picker" ref={ref} data-date-picker={testId || name || ""}>
      <input
        className="date-picker-value"
        type="hidden"
        name={name}
        value={selectedValue}
        data-date-picker-value={testId || name || ""}
        onChange={(event) => commitDate(event.target.value)}
      />
      <button
        className="date-picker-trigger"
        type="button"
        aria-label={`${ariaLabel || t("date")} ${selectedValue}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openPicker}
      >
        <span className="date-picker-text">{selectedValue}</span>
        <Calendar size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="date-picker-popover" role="dialog" aria-label={ariaLabel || t("date")}>
          <div className="date-picker-head">
            <button type="button" aria-label={t("previousMonth")} onClick={() => setCalendarMonth((current) => shiftCalendarMonth(current, -1))}>
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <strong data-calendar-month={calendarMonth}>{formatCalendarMonth(calendarMonth, language)}</strong>
            <button type="button" aria-label={t("nextMonth")} onClick={() => setCalendarMonth((current) => shiftCalendarMonth(current, 1))}>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="date-picker-grid" aria-hidden="true">
            {weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
          </div>
          <div className="date-picker-grid">
            {days.map((day) => (
              <button
                className={`date-picker-day${day.inMonth ? "" : " outside"}${day.value === selectedValue ? " selected" : ""}`}
                type="button"
                key={day.value}
                data-date-value={day.value}
                aria-pressed={day.value === selectedValue}
                onClick={() => commitDate(day.value)}
              >
                {day.day}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Dashboard({ data, t, language, theme, weightUnit, protectedRun, setData, displayRange }) {
  const latest = data.records.at(-1) || {};
  const [weightDraft, setWeightDraft] = useState(displayWeightValue(latest.weightKg, weightUnit));
  const [visibleWeightSeries, setVisibleWeightSeries] = useState({
    weight: true,
    ma7: true,
    ma14: true,
    target: false,
  });
  useEffect(() => setWeightDraft(displayWeightValue(latest.weightKg, weightUnit)), [latest.weightKg, weightUnit]);
  const chartPalette = chartTheme(theme);
  const changes = data.goalProgress?.changes || {};
  const weightSeriesOptions = [
    { key: "weight", label: t("weightLine"), values: kgSeriesToDisplay(data.chartSeries.weights, weightUnit), tone: "cyan" },
    { key: "ma7", label: t("ma7"), values: kgSeriesToDisplay(data.chartSeries.ma7, weightUnit), tone: "green" },
    { key: "ma14", label: t("ma14"), values: kgSeriesToDisplay(data.chartSeries.ma14, weightUnit), tone: "amber" },
    { key: "target", label: t("targetLine"), values: (data.chartSeries.weights || []).map(() => kgToDisplayWeight(data.user.targetWeightKg, weightUnit)), tone: "target" },
  ];
  const visibleWeightDatasets = weightSeriesOptions.filter((item) => visibleWeightSeries[item.key]);
  return (
    <section className="dashboard-grid">
      <form className="panel control-panel" onSubmit={(event) => {
        event.preventDefault();
        const payload = formRecord(new FormData(event.currentTarget), weightDraft, weightUnit);
        protectedRun(async () => applyServerState(await api.saveRecord({ ...payload, userId: data.user.id }), setData), "saved");
      }}>
        <div className="panel-title"><h2>{t("todayCheckin")}</h2><span>{data.records.length} {t("records")}</span></div>
        <div className="form-grid">
          <Field t={t} language={language} name="date" label="date" type="date" defaultValue={latest.date || today()} />
          <label>{t("weight")} ({displayWeightUnit(t, weightUnit)})
            <div className="stepper">
              <input name="weightKg" type="number" step="any" min="0" value={weightDraft} required onChange={(event) => setWeightDraft(event.target.value)} />
              <div>
                <button type="button" onClick={() => setWeightDraft((numberValue(weightDraft, 0) + displayWeightStep(weightUnit)).toFixed(1))}>▲</button>
                <button type="button" onClick={() => setWeightDraft(Math.max(0, numberValue(weightDraft, 0) - displayWeightStep(weightUnit)).toFixed(1))}>▼</button>
              </div>
            </div>
          </label>
          <Field t={t} name="sleepHours" label="sleep" type="number" step="0.1" min="0" max="24" defaultValue={latest.sleepHours} unit="hours" />
          <Field t={t} name="exerciseCalories" label="exerciseCalories" type="number" step="1" min="0" defaultValue={latest.exerciseCalories} unit="kcal" />
        </div>
        <label>{t("exerciseName")}<input name="exerciseName" defaultValue={latest.exerciseItems?.[0]?.name || ""} /></label>
        <label>{t("food")}<textarea name="foodText" placeholder={t("foodPlaceholder")} defaultValue={latest.foodText || ""} /></label>
        <label>{t("note")}<textarea name="note" defaultValue={latest.note || ""} /></label>
        <button className="primary" type="submit"><Save size={16} />{t("saveCheckin")}</button>
      </form>
      <section className="panel hero-chart">
        <div className="panel-title"><h2>{t("trend")}</h2><span>{t("lastSixMonths")} · {displayRange.start} - {displayRange.end}</span></div>
        <div className="series-toggles" aria-label={t("trend")}>
          {weightSeriesOptions.map((item) => (
            <button
              key={item.key}
              type="button"
              className={visibleWeightSeries[item.key] ? "series-toggle active" : "series-toggle"}
              aria-pressed={visibleWeightSeries[item.key] ? "true" : "false"}
              onClick={() => setVisibleWeightSeries((current) => ({ ...current, [item.key]: !current[item.key] }))}
            >
              <span style={{ background: chartPalette.series[item.tone] }} />
              {item.label}
            </button>
          ))}
        </div>
        <LineChart t={t} theme={theme} id="weightChart" labels={data.chartSeries.dates} datasets={visibleWeightDatasets} height={260} />
      </section>
      <GoalPanel t={t} goal={data.goalProgress} weightUnit={weightUnit} />
      <PredictionPanel t={t} predictions={data.predictions} weightUnit={weightUnit} />
      <section className="panel"><div className="panel-title"><h2>{t("exerciseChart")}</h2><span>{t("kcal")}</span></div><LineChart t={t} theme={theme} labels={data.chartSeries.dates} datasets={[{ values: data.chartSeries.exerciseCalories, tone: "green" }]} height={170} /></section>
      <section className="panel"><div className="panel-title"><h2>{t("sleepChart")}</h2><span>{t("hours")}</span></div><LineChart t={t} theme={theme} labels={data.chartSeries.dates} datasets={[{ values: data.chartSeries.sleepHours, tone: "amber" }]} height={170} /></section>
    </section>
  );
}

function Field({ t, language, name, label, type, step, min, max, defaultValue, unit }) {
  if (type === "date") {
    return <DatePickerField t={t} language={language} name={name} label={label} defaultValue={fmt(defaultValue) || today()} />;
  }
  return <label>{t(label)}{unit ? ` (${t(unit)})` : ""}<input name={name} type={type} step={step} min={min} max={max} defaultValue={fmt(defaultValue)} /></label>;
}

function numericBounds(name) {
  if (name === "sleepHours") return { min: "0", max: "24" };
  if (name === "weightKg" || name === "exerciseCalories") return { min: "0" };
  return {};
}

function numericStep(name) {
  if (name === "weightKg") return "any";
  if (name === "sleepHours") return "0.1";
  return "1";
}

function GoalPanel({ t, goal = {}, weightUnit }) {
  return (
    <section className="panel metric-panel">
      <div className="panel-title"><h2>{t("goalProgress")}</h2><span>{goal.completionPercent || 0}%</span></div>
      <div className="metric-list">
        <Metric t={t} label="currentWeight" value={weightUnitValue(t, goal.currentWeightKg, weightUnit)} />
        <Metric t={t} label="distance" value={weightUnitValue(t, goal.distanceKg, weightUnit)} />
        <Metric t={t} label="completion" value={`${goal.completionPercent || 0}%`} />
        <Metric t={t} label="estimatedDate" value={goal.estimatedDate || "-"} />
      </div>
      <div className="progress"><span style={{ width: `${Math.min(100, goal.completionPercent || 0)}%` }} /></div>
    </section>
  );
}

function PredictionPanel({ t, predictions = [], weightUnit }) {
  return (
    <section className="panel prediction-panel">
      <div className="panel-title"><h2>{t("prediction")}</h2><span>{predictions[0] ? t(predictions[0].confidence) : ""}</span></div>
      {predictions.length ? (
        <>
          {predictions.map((item, index) => <article className="prediction-row" key={item.targetDate}>
            <strong>{index === 0 ? t("tomorrow") : t("dayAfter")} · {item.targetDate}</strong>
            <span>{displayWeightValue(item.minWeightKg, weightUnit)} - {displayWeightValue(item.maxWeightKg, weightUnit)} {displayWeightUnit(t, weightUnit)}</span>
            <p>{item.factors.join(" · ")}</p>
          </article>)}
          <p className="muted">{predictions[0].suggestion}</p>
        </>
      ) : <p className="muted">{t("emptyPrediction")}</p>}
    </section>
  );
}

function Analysis({ data, t, theme, weightUnit }) {
  const analysis = data.analysis || {};
  return (
    <section className="analysis-grid">
      <section className="panel">
        <div className="panel-title"><h2>{t("nutrition")}</h2><span>{analysis.enoughData ? t("dataReady") : t("enoughDataHint")}</span></div>
        <div className="metric-list two">
          <Metric t={t} label="averageCalories" value={analysis.averageCalories ? `${analysis.averageCalories} ${t("kcal")}` : "-"} />
          <Metric t={t} label="averageSleep" value={analysis.averageSleepHours ? `${analysis.averageSleepHours} ${t("hours")}` : "-"} />
        </div>
      </section>
      <section className="panel">
        <div className="panel-title"><h2>{t("tagImpact")}</h2></div>
        <div className="bar-list">
          {(analysis.tagImpact || []).length ? analysis.tagImpact.map((item) => (
            <div key={item.tag}><span>{t(item.tag)}</span><meter min={weightUnit === "jin" ? "-2" : "-1"} max={weightUnit === "jin" ? "2" : "1"} value={kgToDisplayWeight(item.averageDeltaKg, weightUnit)} /><b>{displayWeightValue(item.averageDeltaKg, weightUnit)} {displayWeightUnit(t, weightUnit)}</b></div>
          )) : <p className="muted">{t("enoughDataHint")}</p>}
        </div>
      </section>
      <section className="panel wide"><div className="panel-title"><h2>{t("sleepRelation")}</h2><span>{t("hours")}</span></div><LineChart t={t} theme={theme} labels={data.chartSeries.dates} datasets={[{ values: data.chartSeries.sleepHours, tone: "amber" }, { values: kgSeriesToDisplay(data.chartSeries.weights, weightUnit), tone: "cyan" }]} height={240} /></section>
      <section className="panel wide"><div className="panel-title"><h2>{t("predictionAccuracy")}</h2></div><p className="muted">{data.predictions?.[0]?.suggestion || t("emptyPrediction")}</p></section>
    </section>
  );
}

function HistoryView({ data, t, language, weightUnit, filter, setFilter, protectedRun, setData }) {
  const rows = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const sorted = [...data.records].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (!needle) return sorted;
    return sorted.filter((record) => JSON.stringify(record).toLowerCase().includes(needle));
  }, [data.records, filter]);
  return (
    <section className="panel wide-table">
      <div className="panel-title"><h2>{t("history")}</h2><label className="compact">{t("filter")}<input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={t("all")} /></label></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>{t("date")}</th><th>{t("weight")} ({displayWeightUnit(t, weightUnit)})</th><th>{t("food")}</th><th>{t("exerciseCalories")}</th><th>{t("sleep")}</th><th>{t("note")}</th><th /></tr></thead>
          <tbody>{rows.length ? rows.map((record) => <HistoryRow key={record.date} record={record} data={data} t={t} language={language} weightUnit={weightUnit} protectedRun={protectedRun} setData={setData} />) : <tr><td colSpan="7">{t("noRows")}</td></tr>}</tbody>
        </table>
      </div>
    </section>
  );
}

function HistoryRow({ record, data, t, language, weightUnit, protectedRun, setData }) {
  const [row, setRow] = useState(rowFromRecord(record, weightUnit));
  useEffect(() => setRow(rowFromRecord(record, weightUnit)), [record, weightUnit]);
  function setField(name, value) {
    setRow((current) => ({ ...current, [name]: value }));
  }
  return (
    <tr>
      {["date", "weightKg", "foodText", "exerciseCalories", "sleepHours", "note"].map((name) => (
        <td key={name}>
          {name === "date" ? (
            <DatePickerInput t={t} language={language} name={name} ariaLabel={t("date")} value={row[name]} onChange={(value) => setField(name, value)} testId={`history-${record.date}`} />
          ) : (
            <input name={name} type={["weightKg", "exerciseCalories", "sleepHours"].includes(name) ? "number" : "text"} step={numericStep(name)} {...numericBounds(name)} value={row[name]} onChange={(event) => setField(name, event.target.value)} />
          )}
        </td>
      ))}
      <td className="row-actions">
        <button onClick={() => protectedRun(async () => applyServerState(await api.saveRecord({ ...serializeRow(row, weightUnit), userId: data.user.id }), setData), "saved")}><Save size={15} />{t("save")}</button>
        <button onClick={() => protectedRun(async () => applyServerState(await api.deleteRecord(data.user.id, record.date), setData), "dataReady")}><Trash2 size={15} />{t("delete")}</button>
      </td>
    </tr>
  );
}

function ImportView({ data, t, language, weightUnit, draftRows, setDraftRows, protectedRun, setData }) {
  const [excelFile, setExcelFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  return (
    <section className="import-grid">
      <section className="panel">
        <div className="panel-title"><h2>{t("excelImport")}</h2><a className="button-link" href="/api/import/sample.xlsx"><Download size={16} />{t("downloadSample")}</a></div>
        <p className="muted">{t("excelHint")}</p>
        <label className="file-picker">
          <Upload size={18} />
          <span>{excelFile ? `${t("excelSelected")}: ${excelFile.name}` : t("uploadExcel")}</span>
          <input type="file" accept=".xlsx" onChange={(event) => setExcelFile(event.target.files?.[0] || null)} />
        </label>
        <div className="button-row">
          <button className="primary" onClick={() => protectedRun(async () => {
            if (!excelFile) throw new Error(t("uploadExcel"));
            const payload = await api.parseImportFile(excelFile.name, await fileToBase64(excelFile), weightUnit);
            setDraftRows(payload.rows || []);
          }, "dataReady")}><Database size={16} />{t("parse")}</button>
          <button className="ghost" onClick={() => protectedRun(async () => setDraftRows([...draftRows, { date: today(), weightKg: "", foodText: "", exerciseCalories: "", sleepHours: "" }]))}>{t("addRow")}</button>
        </div>
      </section>
      <section className="panel">
        <div className="panel-title"><h2>{t("imageImport")}</h2></div>
        <p className="muted">{t("imageFallback")}</p>
        <label className="file-picker">
          <Upload size={18} />
          <span>{imageFile ? imageFile.name : t("imageImport")}</span>
          <input type="file" accept="image/*" onChange={(event) => setImageFile(event.target.files?.[0] || null)} />
        </label>
        <button className="primary" onClick={() => protectedRun(async () => {
          if (!imageFile) throw new Error(t("imageImport"));
          const payload = await api.parseImage(imageFile.type || "image/png", await fileToBase64(imageFile));
          setDraftRows(payload.rows || []);
        }, "dataReady")}>{t("parseImage")}</button>
      </section>
      <section className="panel wide">
        <div className="panel-title"><h2>{t("manualRows")}</h2><span>{draftRows.length}</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t("date")}</th><th>{t("weight")} ({displayWeightUnit(t, weightUnit)})</th><th>{t("food")}</th><th>{t("exerciseCalories")}</th><th>{t("sleep")}</th><th>{t("note")}</th><th /></tr></thead>
            <tbody>{draftRows.length ? draftRows.map((row, index) => <ImportRow key={index} row={row} index={index} draftRows={draftRows} setDraftRows={setDraftRows} t={t} language={language} weightUnit={weightUnit} />) : <tr><td colSpan="7">{t("noRows")}</td></tr>}</tbody>
          </table>
        </div>
        <div className="button-row">
          <button className="primary" onClick={() => protectedRun(async () => {
            applyServerState(await api.confirmImport(data.user.id, draftRows.map((row) => serializeRow(row, "kg"))), setData);
            setDraftRows([]);
          }, "saved")}><Save size={16} />{t("commitImport")}</button>
          <button className="ghost" onClick={() => protectedRun(async () => setDraftRows([]))}>{t("cancelImport")}</button>
        </div>
      </section>
    </section>
  );
}

function ImportRow({ row, index, draftRows, setDraftRows, t, language, weightUnit }) {
  const fields = ["date", "weightKg", "foodText", "exerciseCalories", "sleepHours", "note"];
  function update(name, value) {
    const next = draftRows.slice();
    next[index] = { ...next[index], [name]: value };
    setDraftRows(next);
  }
  return (
    <tr>
      {fields.map((name) => (
        <td key={name}>
          {name === "date" ? (
            <DatePickerInput t={t} language={language} ariaLabel={t("date")} value={fmt(row[name]) || today()} onChange={(value) => update(name, value)} testId={`import-${index}`} />
          ) : (
            <input
              type={["weightKg", "exerciseCalories", "sleepHours"].includes(name) ? "number" : "text"}
              step={numericStep(name)}
              {...numericBounds(name)}
              value={name === "weightKg" ? displayWeightValue(row[name], weightUnit) : fmt(row[name])}
              onChange={(event) => update(name, name === "weightKg" ? inputWeightToKg(event.target.value, weightUnit) : event.target.value)}
            />
          )}
        </td>
      ))}
      <td><button onClick={() => setDraftRows(draftRows.filter((_, rowIndex) => rowIndex !== index))}><Trash2 size={15} />{t("delete")}</button></td>
    </tr>
  );
}

function Metric({ t, label, value }) {
  return <div><span>{t(label)}</span><strong>{value}</strong></div>;
}

function normalizeDateValue(value) {
  if (isDateValue(value)) return value;
  return today();
}

function isDateValue(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function monthValueForDate(value) {
  return normalizeDateValue(value).slice(0, 7);
}

function shiftCalendarMonth(monthValue, delta) {
  const [year, month] = monthValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`;
}

function calendarDays(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, 1 - firstDay + index));
    return {
      value: utcDateValue(date),
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === month - 1,
    };
  });
}

function utcDateValue(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function weekdayLabels(language) {
  return language === "zh" ? ["日", "一", "二", "三", "四", "五", "六"] : ["S", "M", "T", "W", "T", "F", "S"];
}

function formatCalendarMonth(monthValue, language) {
  const [year, month] = monthValue.split("-").map(Number);
  if (language === "zh") return `${year}年${month}月`;
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function LineChart({ t, theme = "dark", labels = [], datasets = [], height = 170 }) {
  const canvasRef = useRef(null);
  const pointsRef = useRef([]);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    pointsRef.current = drawLineChart(canvasRef.current, t, labels, datasets, height, theme);
  }, [t, theme, labels, datasets, height]);

  function updateTooltip(event) {
    const canvas = canvasRef.current;
    if (!canvas || !pointsRef.current.length) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const nearest = pointsRef.current
      .map((point) => ({ ...point, distance: Math.hypot(point.x - x, point.y - y) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (!nearest || nearest.distance > 28) {
      setTooltip(null);
      return;
    }
    setTooltip({
      x: Math.max(8, Math.min(rect.width - 150, nearest.x + 10)),
      y: Math.max(8, nearest.y - 42),
      color: nearest.color,
      label: nearest.label,
      date: nearest.date,
      value: nearest.value,
    });
  }

  return (
    <div className="chart-frame" onPointerMove={updateTooltip} onPointerLeave={() => setTooltip(null)}>
      <canvas ref={canvasRef} height={height} />
      {tooltip && (
        <div className="chart-tooltip" style={{ left: tooltip.x, top: tooltip.y, borderColor: tooltip.color }}>
          <strong>{tooltip.date}</strong>
          <span>{tooltip.label ? `${tooltip.label}: ` : ""}{tooltip.value}</span>
        </div>
      )}
    </div>
  );
}

function drawLineChart(canvas, t, labels, datasets, height, theme) {
  if (!canvas) return [];
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(320, rect.width) * ratio;
  canvas.height = height * ratio;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const width = canvas.width / ratio;
  const pad = { left: 42, right: 16, top: 22, bottom: 34 };
  const palette = chartTheme(theme);
  const resolveTone = (set) => set.color || palette.series[set.tone] || palette.axis;
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = palette.grid;
  for (let i = 0; i < 4; i += 1) {
    const y = pad.top + ((height - pad.top - pad.bottom) / 3) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
  }
  const allValues = datasets.flatMap((set) => (set.values || []).filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value))).map(Number));
  if (!allValues.length) {
    ctx.fillStyle = palette.empty;
    ctx.fillText(t("noRows"), pad.left, height / 2);
    return [];
  }
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = max - min || 1;
  const xFor = (index) => pad.left + ((width - pad.left - pad.right) * index) / Math.max(1, labels.length - 1);
  const yFor = (value) => height - pad.bottom - ((Number(value) - min) / span) * (height - pad.top - pad.bottom);
  const points = [];
  datasets.forEach((set) => {
    const color = resolveTone(set);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let started = false;
    (set.values || []).forEach((value, index) => {
      if (value === null || value === undefined || !Number.isFinite(Number(value))) return;
      if (!started) {
        ctx.moveTo(xFor(index), yFor(value));
        started = true;
      } else {
        ctx.lineTo(xFor(index), yFor(value));
      }
    });
    ctx.stroke();
    (set.values || []).forEach((value, index) => {
      if (value === null || value === undefined || !Number.isFinite(Number(value))) return;
      const x = xFor(index);
      const y = yFor(value);
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
      points.push({
        x,
        y,
        value: Number(value).toFixed(1),
        color,
        label: set.label || "",
        date: labels[index] || "",
      });
    });
  });
  ctx.fillStyle = palette.axis;
  ctx.font = "12px system-ui";
  ctx.fillText(String(max.toFixed(1)), 4, pad.top + 4);
  ctx.fillText(String(min.toFixed(1)), 4, height - pad.bottom);
  if (labels.length) {
    ctx.fillText(labels[0].slice(5), pad.left, height - 10);
    ctx.fillText(labels.at(-1).slice(5), width - 70, height - 10);
  }
  return points;
}

function chartTheme(theme) {
  return theme === "light" ? CHART_THEMES.light : CHART_THEMES.dark;
}

function applyServerState(payload, setData) {
  setData((current) => {
    const user = payload.user || current.user;
    return {
      user,
      records: payload.records || current.records || [],
      chartSeries: payload.chartSeries || current.chartSeries || initialData.chartSeries,
      goalProgress: payload.goalProgress || current.goalProgress || {},
      predictions: payload.predictions || current.predictions || [],
      analysis: payload.analysis || current.analysis || {}
    };
  });
  const storedUser = payload.user;
  if (storedUser) {
    localStorage.setItem("betweenPoints.userId", storedUser.id);
    localStorage.setItem("betweenPoints.lang", storedUser.language);
    if (payload.session?.token) {
      localStorage.setItem("betweenPoints.sessionToken", payload.session.token);
      localStorage.setItem("betweenPoints.sessionExpiresAt", payload.session.expiresAt || "");
    }
  }
}

function applyDisplayRange(data, range) {
  const records = filterRecordsByRange(data.records || [], range);
  return {
    ...data,
    records,
    chartSeries: filterChartSeriesByRange(data.chartSeries || initialData.chartSeries, range),
    analysis: {
      ...(data.analysis || {}),
      recordCount: records.length,
    },
  };
}

function filterRecordsByRange(records, range) {
  return [...records]
    .filter((record) => record.date && record.date >= range.start && record.date <= range.end)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function filterChartSeriesByRange(series, range) {
  const keepIndexes = (series.dates || [])
    .map((date, index) => ({ date, index }))
    .filter((item) => item.date >= range.start && item.date <= range.end)
    .map((item) => item.index);
  const pick = (values = []) => keepIndexes.map((index) => values[index]);
  return {
    dates: pick(series.dates || []),
    weights: pick(series.weights || []),
    ma7: pick(series.ma7 || []),
    ma14: pick(series.ma14 || []),
    exerciseCalories: pick(series.exerciseCalories || []),
    sleepHours: pick(series.sleepHours || []),
    caloriesIn: pick(series.caloriesIn || []),
  };
}

function formRecord(data, weightDraft, weightUnit) {
  return {
    date: data.get("date"),
    weightKg: inputWeightToKg(weightDraft, weightUnit),
    foodText: data.get("foodText") || "",
    exerciseItems: data.get("exerciseName") ? [{ name: data.get("exerciseName"), durationMinutes: null, caloriesBurned: numberValue(data.get("exerciseCalories")) }] : [],
    exerciseCalories: numberValue(data.get("exerciseCalories"), 0),
    sleepHours: numberValue(data.get("sleepHours")),
    tags: [],
    note: data.get("note") || ""
  };
}

function rowFromRecord(record, weightUnit) {
  return {
    date: record.date || "",
    weightKg: displayWeightValue(record.weightKg, weightUnit),
    foodText: record.foodText || "",
    exerciseCalories: fmt(record.exerciseCalories),
    sleepHours: fmt(record.sleepHours),
    note: record.note || ""
  };
}

function serializeRow(row, weightUnit = "kg") {
  return {
    date: row.date,
    weightKg: inputWeightToKg(row.weightKg, weightUnit),
    foodText: row.foodText || "",
    exerciseCalories: numberValue(row.exerciseCalories, 0),
    sleepHours: numberValue(row.sleepHours),
    tags: [],
    note: row.note || ""
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result).split(",")[1] || ""));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function numberValue(value, fallback = null) {
  if (value === "" || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function fmt(value) {
  return value === null || value === undefined ? "" : String(value);
}

function normalizeWeightUnit(value) {
  return value === "jin" ? "jin" : "kg";
}

function kgToDisplayWeight(value, weightUnit) {
  const number = numberValue(value);
  if (number === null) return null;
  return normalizeWeightUnit(weightUnit) === "jin" ? number * 2 : number;
}

function inputWeightToKg(value, weightUnit) {
  const number = numberValue(value);
  if (number === null) return null;
  return normalizeWeightUnit(weightUnit) === "jin" ? number / 2 : number;
}

function kgSeriesToDisplay(values = [], weightUnit) {
  return values.map((value) => kgToDisplayWeight(value, weightUnit));
}

function displayWeightStep(weightUnit) {
  return normalizeWeightUnit(weightUnit) === "jin" ? 0.2 : 0.1;
}

function displayWeightValue(value, weightUnit) {
  const displayValue = kgToDisplayWeight(value, weightUnit);
  if (displayValue === null) return "";
  return formatWeightNumber(displayValue);
}

function weightUnitValue(t, value, weightUnit) {
  const displayValue = displayWeightValue(value, weightUnit);
  return displayValue === "" ? "-" : `${displayValue} ${displayWeightUnit(t, weightUnit)}`;
}

function displayWeightUnit(t, weightUnit) {
  return normalizeWeightUnit(weightUnit) === "jin" ? t("jin") : t("kg");
}

function formatWeightNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return String(Math.round((number + Number.EPSILON) * 100) / 100);
}

function browserLanguage() {
  return (navigator.language || "zh").toLowerCase().startsWith("zh") ? "zh" : "en";
}

createRoot(document.querySelector("#root")).render(<App />);
