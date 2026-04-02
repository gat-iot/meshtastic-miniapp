var ble = require('../../utils/ble');

Page({
  data: {
    scanning: false,
    devices: [],
    connectedDevice: null,
    isConnected: false,
    error: null
  },

  onShow: function() {
    var app = getApp();
    this.setData({
      connectedDevice: app.globalData.connectedDevice,
      isConnected: ble.isConnected
    });
  },

  scanDevices: function() {
    var that = this;
    that.setData({ scanning: true, error: null, devices: [] });
    
    wx.openBluetoothAdapter({
      success: function() {
        wx.startBluetoothDevicesDiscovery({
          allowDuplicatesKey: false,
          success: function() {
            wx.showToast({ title: '扫描中...', icon: 'none', duration: 2000 });
            
            setTimeout(function() {
              wx.getBluetoothDevices({
                success: function(res) {
                  console.log('发现设备:', res.devices);
                  that.setData({ devices: res.devices, scanning: false });
                  wx.stopBluetoothDevicesDiscovery({});
                },
                fail: function() {
                  that.setData({ scanning: false });
                }
              });
            }, 8000);
          },
          fail: function() {
            that.setData({ scanning: false });
          }
        });
      },
      fail: function() {
        that.setData({ scanning: false });
        wx.showModal({
          title: '蓝牙错误',
          content: '请确保手机蓝牙已开启',
          showCancel: false
        });
      }
    });
  },

  connectDevice: function(e) {
    var that = this;
    var deviceId = e.currentTarget.dataset.id;
    var device = this.data.devices.find(function(d) { return d.deviceId === deviceId; });
    
    // 使用 ble 模块连接
    ble.connect(deviceId, function(result) {
      if (result.success) {
        console.log('连接成功，启用监听');
        
        // 启用数据监听
        ble.startListen();
        ble.onMessage = function(msg) {
          console.log('收到设备消息:', msg);
          // 保存到全局消息
          var app = getApp();
          app.globalData.messages.push({
            id: Date.now(),
            type: 'received',
            text: '收到数据: ' + msg.data,
            time: new Date().toLocaleTimeString()
          });
        };
        
        // 保存到全局
        var app = getApp();
        app.globalData.deviceId = deviceId;
        app.globalData.connectedDevice = device;
        
        that.setData({
          connectedDevice: device,
          isConnected: true,
          devices: []
        });
        
        wx.showToast({ title: '连接成功', icon: 'success' });
      } else {
        wx.showToast({ title: '连接失败', icon: 'none' });
      }
    });
  },

  disconnect: function() {
    var that = this;
    wx.showModal({
      title: '断开连接',
      content: '确定断开设备？',
      success: function(res) {
        if (res.confirm) {
          ble.disconnect();
          var app = getApp();
          app.globalData.deviceId = null;
          app.globalData.connectedDevice = null;
          that.setData({ connectedDevice: null, isConnected: false });
          wx.showToast({ title: '已断开', icon: 'success' });
        }
      }
    });
  }
});