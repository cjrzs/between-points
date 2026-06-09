import assert from "node:assert/strict";
import { getDisplayRange, shiftMonths, today } from "../frontend/src/dateRange.js";

assert.equal(today(new Date(2026, 0, 2, 3, 4)), "2026-01-02");
assert.equal(shiftMonths("2026-06-09", -6), "2025-12-09");
assert.equal(shiftMonths("2026-03-31", -1), "2026-03-03");

assert.deepEqual(
  getDisplayRange({}, "2026-06-09"),
  { start: "2025-12-09", end: "2026-06-09" },
  "default display range should be the latest six months ending today"
);

assert.deepEqual(
  getDisplayRange({ end: "2026-06-07" }, "2026-06-09"),
  { start: "2025-12-07", end: "2026-06-07" },
  "manual end date should still derive a six-month window from that end date"
);

assert.deepEqual(
  getDisplayRange({ start: "2025-01-01", end: "2026-06-07" }, "2026-06-09"),
  { start: "2025-12-07", end: "2026-06-07" },
  "manual start date should clamp to the six-month display window"
);
