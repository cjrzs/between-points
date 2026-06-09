const SESSION_KEY = "bp.sessionToken";
const SESSION_EXPIRES_KEY = "bp.sessionExpiresAt";
const USER_KEY = "bp.user";
const API_BASE_KEY = "bp.apiBaseUrl";

function apiBaseUrl() {
  const app = getApp();
  return wx.getStorageSync(API_BASE_KEY) || (app.globalData && app.globalData.apiBaseUrl) || "http://127.0.0.1:4173";
}

function request(path, options) {
  const config = options || {};
  const token = wx.getStorageSync(SESSION_KEY);
  const header = { "Content-Type": "application/json" };
  if (token) {
    header.Authorization = `Bearer ${token}`;
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${apiBaseUrl()}${path}`,
      method: config.method || "GET",
      data: config.data || {},
      header,
      success(response) {
        const payload = response.data || {};
        if (response.statusCode >= 400) {
          reject(new Error(payload.error || "请求失败"));
          return;
        }
        resolve(payload);
      },
      fail(error) {
        reject(new Error(error.errMsg || "网络连接失败"));
      }
    });
  });
}

function rememberSession(payload) {
  if (payload.user) {
    wx.setStorageSync(USER_KEY, payload.user);
    getApp().globalData.user = payload.user;
  }
  if (payload.session && payload.session.token) {
    wx.setStorageSync(SESSION_KEY, payload.session.token);
    wx.setStorageSync(SESSION_EXPIRES_KEY, payload.session.expiresAt || "");
  }
  if (payload.records || payload.goalProgress || payload.analysis) {
    getApp().globalData.state = payload;
  }
  return payload;
}

function hasSession() {
  return Boolean(wx.getStorageSync(SESSION_KEY));
}

function clearSession() {
  wx.removeStorageSync(SESSION_KEY);
  wx.removeStorageSync(SESSION_EXPIRES_KEY);
  wx.removeStorageSync(USER_KEY);
  getApp().globalData.user = null;
  getApp().globalData.state = null;
}

function loginWithWechat(displayName) {
  return new Promise((resolve, reject) => {
    wx.login({
      success(result) {
        if (!result.code) {
          reject(new Error("微信登录失败"));
          return;
        }
        request("/api/wechat/login", {
          method: "POST",
          data: {
            code: result.code,
            displayName: displayName || "微信用户"
          }
        }).then((payload) => resolve(rememberSession(payload))).catch(reject);
      },
      fail(error) {
        reject(new Error(error.errMsg || "微信登录失败"));
      }
    });
  });
}

function loadState() {
  return request("/api/state").then(rememberSession);
}

function updateUser(data) {
  return request("/api/user", { method: "PATCH", data }).then(rememberSession);
}

function saveRecord(record) {
  return request("/api/records", { method: "POST", data: record }).then(rememberSession);
}

function deleteRecord(date) {
  return request(`/api/records?date=${encodeURIComponent(date)}`, { method: "DELETE" }).then(rememberSession);
}

module.exports = {
  clearSession,
  deleteRecord,
  hasSession,
  loadState,
  loginWithWechat,
  request,
  saveRecord,
  updateUser
};
