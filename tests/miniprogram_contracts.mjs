import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const miniRoot = resolve(root, "miniprogram");

assert(existsSync(resolve(miniRoot, "project.config.json")), "mini program should include WeChat project config");
assert(existsSync(resolve(miniRoot, "app.json")), "mini program should include app.json");
assert(existsSync(resolve(miniRoot, "app.js")), "mini program should include app.js");
assert(existsSync(resolve(miniRoot, "utils", "api.js")), "mini program should include shared API client");
assert(existsSync(resolve(miniRoot, "assets", "between-points-avatar.png")), "mini program should include the project avatar asset");

const appConfig = JSON.parse(readFileSync(resolve(miniRoot, "app.json"), "utf8"));
const expectedPages = [
  "pages/dashboard/dashboard",
  "pages/checkin/checkin",
  "pages/history/history",
  "pages/analysis/analysis",
];

for (const page of expectedPages) {
  assert(appConfig.pages.includes(page), `app.json should register ${page}`);
  for (const extension of ["js", "wxml", "wxss", "json"]) {
    assert(existsSync(resolve(miniRoot, `${page}.${extension}`)), `${page}.${extension} should exist`);
  }
}

assert.equal(appConfig.tabBar.list.length, 4, "mini program should expose four core tabs");
assert.equal(appConfig.window.navigationBarTitleText, "Between Points");

const apiClient = readFileSync(resolve(miniRoot, "utils", "api.js"), "utf8");
const appJs = readFileSync(resolve(miniRoot, "app.js"), "utf8");
assert.match(appJs, /apiBaseUrl:\s*"https:\/\/weight\.whisperer\.top"/, "mini program should default to the production API base URL");
assert.match(apiClient, /"https:\/\/weight\.whisperer\.top"/, "API client fallback should use the production API base URL");
assert.match(apiClient, /wx\.login/, "API client should use wx.login for WeChat auth");
assert.match(apiClient, /\/api\/wechat\/login/, "API client should call backend WeChat login route");
assert.match(apiClient, /Authorization/, "API client should attach bearer token to requests");
assert.match(apiClient, /bp\.sessionToken/, "API client should persist the backend session token");

const checkin = readFileSync(resolve(miniRoot, "pages", "checkin", "checkin.js"), "utf8");
const checkinWxml = readFileSync(resolve(miniRoot, "pages", "checkin", "checkin.wxml"), "utf8");
const checkinWxss = readFileSync(resolve(miniRoot, "pages", "checkin", "checkin.wxss"), "utf8");
assert.match(checkin, /saveRecord/, "check-in page should save records through shared API client");
assert.match(checkin, /weightKg/, "check-in page should capture weight");
assert.match(checkin, /"form\.date": format\.today\(\)/, "check-in page should refresh the default date to today on show");
assert.match(checkinWxml, /class="picker-hit-area"/, "date picker should expose a full-width tappable hit area");
assert.match(checkinWxml, /class="picker-icon"/, "date picker should include a tappable icon inside the picker");
assert.match(checkinWxss, /\.picker-hit-area[\s\S]*display:\s*flex/, "date picker hit area should cover both date text and icon");

const dashboard = readFileSync(resolve(miniRoot, "pages", "dashboard", "dashboard.js"), "utf8");
const dashboardWxml = readFileSync(resolve(miniRoot, "pages", "dashboard", "dashboard.wxml"), "utf8");
const dashboardWxss = readFileSync(resolve(miniRoot, "pages", "dashboard", "dashboard.wxss"), "utf8");
assert.match(dashboard, /loginWithWechat/, "dashboard should offer WeChat login");
assert.match(dashboard, /goalProgress/, "dashboard should show goal progress data");
assert.match(dashboardWxml, /between-points-avatar\.png/, "dashboard home title should show the project avatar");
assert.match(dashboardWxml, /class="brand-lockup"/, "dashboard home title should align avatar beside the app name");
assert.match(dashboardWxss, /\.brand-icon/, "dashboard should size the project avatar for the home title");
