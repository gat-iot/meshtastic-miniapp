Page({
  data: { connected: false, deviceName: '' },
  onShow() {
    const app = getApp();
    this.setData({ connected: !!app.globalData.deviceId, deviceName: app.globalData.connectedDevice?.name || '' });
  },
  disconnect() {
    if (getApp().globalData.deviceId) {
      wx.closeBLEConnection({ deviceId: getApp().globalData.deviceId });
    }
    getApp().globalData.deviceId = null;
    this.setData({ connected: false });
  },
  showAbout() {
    wx.showModal({ title: '关于', content: 'Meshtastic 微信小程序 v1.0', showCancel: false });
  }
});