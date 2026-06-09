function today() {
  const now = new Date();
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join("-");
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function displayNumber(value, suffix) {
  if (value === null || value === undefined || value === "") {
    return "--";
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "--";
  }
  return `${Math.round(number * 10) / 10}${suffix || ""}`;
}

function toNumberOrNull(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function trendBars(records) {
  const recent = (records || []).filter((record) => record.weightKg !== null && record.weightKg !== undefined).slice(-14);
  if (!recent.length) {
    return [];
  }
  const weights = recent.map((record) => Number(record.weightKg));
  const min = Math.min.apply(null, weights);
  const max = Math.max.apply(null, weights);
  const span = Math.max(0.1, max - min);
  return recent.map((record) => {
    const weight = Number(record.weightKg);
    return {
      date: String(record.date || "").slice(5),
      weightKg: displayNumber(weight, "kg"),
      height: Math.max(16, Math.round(((weight - min) / span) * 110) + 18)
    };
  });
}

module.exports = {
  displayNumber,
  today,
  toNumberOrNull,
  trendBars
};
