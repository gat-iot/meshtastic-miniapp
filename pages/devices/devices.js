Page({
  data: {
    isConnected: false,
    deviceName: '',
    deviceId: '',
    rssi: 0
  },

  onShow: function() {
    var app = getApp();
    var device = app.globalData.connectedDevice;
    this.setData({
      isConnected: !!app.globalData.deviceId && app.globalData.isConnected,
      deviceName: device ? (device.name || device.localName) : '',
      deviceId: app.globalData.deviceId || '',
      rssi: device ? device.RSSI : 0
    });
    console.log('设备页面 - 连接状态:', this.data.isConnected);
  }
});