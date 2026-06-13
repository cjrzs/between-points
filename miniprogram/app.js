App({
  globalData: {
    apiBaseUrl: "https://weight.whisperer.top",
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
