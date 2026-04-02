Page({
  data: {
    isConnected: false,
    deviceName: '',
    version: 'v1.0.0'
  },

  onShow: function() {
    var app = getApp();
    var device = app.globalData.connectedDevice;
    this.setData({
      isConnected: !!app.globalData.deviceId && app.globalData.isConnected,
      deviceName: device ? (device.name || device.localName) : ''
    });
    console.log('设置页面 - 连接状态:', this.data.isConnected);
  },

  disconnect: function() {
    var that = this;
    wx.showModal({
      title: '断开连接',
      content: '确定要断开当前设备吗？',
      success: function(res) {
        if (res.confirm) {
          var deviceId = getApp().globalData.deviceId;
          if (deviceId) {
            wx.closeBLEConnection({
              deviceId: deviceId,
              success: function() {
                getApp().globalData.deviceId = null;
                getApp().globalData.connectedDevice = null;
                getApp().globalData.isConnected = false;
                getApp().globalData.serviceId = null;
                that.setData({
                  isConnected: false,
                  deviceName: ''
                });
                wx.showToast({ title: '已断开', icon: 'success' });
              }
            });
          }
        }
      }
    });
  },

  showAbout: function() {
    wx.showModal({
      title: '关于 Meshtastic',
      content: 'Meshtastic 微信小程序\n版本: 1.0.0\n\n用于连接和管理 Meshtastic 设备',
      showCancel: false
    });
  }
});