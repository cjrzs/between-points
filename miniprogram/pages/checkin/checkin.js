const api = require("../../utils/api");
const format = require("../../utils/format");

const tagOptions = [
  { key: "highSalt", label: "高盐" },
  { key: "highCarb", label: "高碳" },
  { key: "diningOut", label: "外食" },
  { key: "training", label: "训练" },
  { key: "lateNight", label: "熬夜" },
  { key: "stress", label: "压力" }
];

Page({
  data: {
    authed: false,
    saving: false,
    form: {
      date: format.today(),
      weightKg: "",
      foodText: "",
      exerciseCalories: "",
      sleepHours: "",
      note: "",
      tags: []
    },
    tagOptions
  },

  onShow() {
    this.setData({
      authed: api.hasSession(),
      "form.date": format.today()
    });
  },

  goLogin() {
    wx.switchTab({ url: "/pages/dashboard/dashboard" });
  },

  onDateChange(event) {
    this.setData({ "form.date": event.detail.value });
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: event.detail.value });
  },

  toggleTag(event) {
    const key = event.currentTarget.dataset.key;
    const tags = this.data.form.tags.slice();
    const index = tags.indexOf(key);
    if (index >= 0) {
      tags.splice(index, 1);
    } else {
      tags.push(key);
    }
    this.setData({ "form.tags": tags });
  },

  submit() {
    if (!api.hasSession()) {
      this.goLogin();
      return;
    }
    const form = this.data.form;
    if (!form.date || !form.weightKg) {
      wx.showToast({ title: "日期和体重必填", icon: "none" });
      return;
    }
    const payload = {
      date: form.date,
      weightKg: format.toNumberOrNull(form.weightKg),
      foodText: form.foodText,
      exerciseCalories: format.toNumberOrNull(form.exerciseCalories) || 0,
      sleepHours: format.toNumberOrNull(form.sleepHours),
      note: form.note,
      tags: form.tags
    };
    this.setData({ saving: true });
    api.saveRecord(payload)
      .then(() => {
        wx.showToast({ title: "已保存", icon: "success" });
        wx.switchTab({ url: "/pages/dashboard/dashboard" });
      })
      .catch((error) => wx.showToast({ title: error.message || "保存失败", icon: "none" }))
      .finally(() => this.setData({ saving: false }));
  }
});
