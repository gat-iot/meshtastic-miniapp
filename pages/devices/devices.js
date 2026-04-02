Page({
  data: { connected: false, deviceName: '' },
  onShow() {
    const app = getApp();
    this.setData({ connected: !!app.globalData.deviceId, deviceName: app.globalData.connectedDevice?.name || '' });
  }
});