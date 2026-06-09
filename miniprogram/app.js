App({
  globalData: {
    apiBaseUrl: "http://127.0.0.1:4173",
    user: null,
    state: null
  },

  onLaunch() {
    const configuredBaseUrl = wx.getStorageSync("bp.apiBaseUrl");
    if (configuredBaseUrl) {
      this.globalData.apiBaseUrl = configuredBaseUrl;
    }
    this.globalData.user = wx.getStorageSync("bp.user") || null;
  }
});
