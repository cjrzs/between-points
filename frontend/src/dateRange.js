export function getDisplayRange(explicitRange = {}, currentDate = today()) {
  const end = explicitRange.end || currentDate;
  const earliestStart = shiftMonths(end, -6);
  let start = explicitRange.start || earliestStart;
  if (start < earliestStart) start = earliestStart;
  if (start > end) start = end;
  return { start, end };
}

export function shiftMonths(value, delta) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 10);
}

export function today(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
