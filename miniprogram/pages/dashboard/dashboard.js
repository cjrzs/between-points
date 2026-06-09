const api = require("../../utils/api");
const format = require("../../utils/format");

Page({
  data: {
    authed: false,
    loading: false,
    user: null,
    latest: null,
    recordsCount: 0,
    goalProgress: {},
    predictions: [],
    trendBars: [],
    currentWeight: "--",
    targetWeight: "--",
    distance: "--",
    error: ""
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    if (!api.hasSession()) {
      this.setData({ authed: false, loading: false, error: "" });
      return;
    }
    this.setData({ loading: true, error: "" });
    api.loadState()
      .then((payload) => this.applyState(payload))
      .catch((error) => {
        api.clearSession();
        this.setData({ authed: false, error: error.message || "加载失败" });
      })
      .finally(() => this.setData({ loading: false }));
  },

  loginWithWechat() {
    this.setData({ loading: true, error: "" });
    api.loginWithWechat()
      .then((payload) => {
        this.applyState(payload);
        wx.showToast({ title: "登录成功", icon: "success" });
      })
      .catch((error) => this.setData({ error: error.message || "登录失败" }))
      .finally(() => this.setData({ loading: false }));
  },

  logout() {
    api.clearSession();
    this.setData({ authed: false, user: null, latest: null, recordsCount: 0, trendBars: [] });
  },

  goCheckin() {
    wx.switchTab({ url: "/pages/checkin/checkin" });
  },

  applyState(payload) {
    const records = payload.records || [];
    const latest = records.length ? records[records.length - 1] : null;
    const progress = payload.goalProgress || {};
    this.setData({
      authed: true,
      user: payload.user || null,
      latest,
      recordsCount: records.length,
      goalProgress: progress,
      predictions: payload.predictions || [],
      trendBars: format.trendBars(records),
      currentWeight: format.displayNumber(progress.currentWeightKg, "kg"),
      targetWeight: format.displayNumber(progress.targetWeightKg, "kg"),
      distance: format.displayNumber(progress.distanceKg, "kg"),
      error: ""
    });
  }
});
