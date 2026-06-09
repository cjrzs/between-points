const api = require("../../utils/api");
const format = require("../../utils/format");

Page({
  data: {
    authed: false,
    loading: false,
    records: []
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    if (!api.hasSession()) {
      this.setData({ authed: false, records: [] });
      return;
    }
    this.setData({ authed: true, loading: true });
    api.loadState()
      .then((payload) => {
        const records = (payload.records || []).slice().reverse().map((record) => ({
          ...record,
          weightText: format.displayNumber(record.weightKg, "kg"),
          sleepText: format.displayNumber(record.sleepHours, "h"),
          exerciseText: format.displayNumber(record.exerciseCalories, "kcal")
        }));
        this.setData({ records });
      })
      .catch((error) => wx.showToast({ title: error.message || "加载失败", icon: "none" }))
      .finally(() => this.setData({ loading: false }));
  },

  goLogin() {
    wx.switchTab({ url: "/pages/dashboard/dashboard" });
  },

  goCheckin() {
    wx.switchTab({ url: "/pages/checkin/checkin" });
  },

  deleteRecord(event) {
    const date = event.currentTarget.dataset.date;
    wx.showModal({
      title: "删除记录",
      content: `确定删除 ${date} 的记录吗？`,
      confirmColor: "#af3428",
      success: (result) => {
        if (!result.confirm) return;
        api.deleteRecord(date)
          .then(() => {
            wx.showToast({ title: "已删除", icon: "success" });
            this.refresh();
          })
          .catch((error) => wx.showToast({ title: error.message || "删除失败", icon: "none" }));
      }
    });
  }
});
