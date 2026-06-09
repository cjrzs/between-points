const api = require("../../utils/api");
const format = require("../../utils/format");

Page({
  data: {
    authed: false,
    loading: false,
    analysis: {},
    predictions: [],
    averageCalories: "--",
    averageSleep: "--",
    recordCount: 0,
    tagImpact: []
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    if (!api.hasSession()) {
      this.setData({ authed: false });
      return;
    }
    this.setData({ authed: true, loading: true });
    api.loadState()
      .then((payload) => {
        const analysis = payload.analysis || {};
        this.setData({
          analysis,
          predictions: payload.predictions || [],
          averageCalories: format.displayNumber(analysis.averageCalories, "kcal"),
          averageSleep: format.displayNumber(analysis.averageSleepHours, "h"),
          recordCount: analysis.recordCount || 0,
          tagImpact: analysis.tagImpact || []
        });
      })
      .catch((error) => wx.showToast({ title: error.message || "加载失败", icon: "none" }))
      .finally(() => this.setData({ loading: false }));
  },

  goLogin() {
    wx.switchTab({ url: "/pages/dashboard/dashboard" });
  },

  goCheckin() {
    wx.switchTab({ url: "/pages/checkin/checkin" });
  }
});
