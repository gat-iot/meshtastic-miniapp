var ble = require('../../utils/ble');

Page({
  data: {
    connected: false,
    deviceName: '',
    version: 'v1.0.0'
  },

  onShow: function() {
    this.setData({
      connected: ble.connected,
      deviceName: ble.nodeName || ''
    });
  },

  disconnect: function() {
    var that = this;
    wx.showModal({
      title: '断开连接',
      content: '确定要断开吗？',
      success: function(res) {
        if (res.confirm) {
          ble.disconnect(function() {
            that.setData({ connected: false, deviceName: '' });
            wx.showToast({ title: '已断开', icon: 'success' });
          });
        }
      }
    });
  },

  clearMessages: function() {
    wx.showModal({
      title: '清除消息',
      content: '确定清除所有消息？',
      success: function(res) {
        if (res.confirm) {
          getApp().globalData.messages = [];
          wx.showToast({ title: '已清除', icon: 'success' });
        }
      }
    });
  },

  showAbout: function() {
    wx.showModal({
      title: '关于',
      content: 'Meshtastic 微信小程序\n版本: 1.0.0\n\n离网通信客户端\n支持 BLE 连接 Meshtastic 设备',
      showCancel: false
    });
  }
});