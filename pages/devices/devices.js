var ble = require('../../utils/ble');

Page({
  data: {
    scanning: false,
    devices: [],
    connected: false,
    deviceName: '',
    debugLog: ''
  },

  onShow: function() {
    this.setData({
      connected: ble.connected,
      deviceName: ble.nodeName || ''
    });
    
    // 启用通知
    if (ble.connected) {
      ble.enableNotify();
    }
  },

  log: function(msg) {
    console.log(msg);
    this.setData({
      debugLog: this.data.debugLog + msg + '\n'
    });
  },

  scanDevices: function() {
    var that = this;
    that.setData({ scanning: true, devices: [], debugLog: '' });
    that.log('开始扫描...');

    wx.openBluetoothAdapter({
      success: function() {
        that.log('蓝牙初始化成功');
        
        wx.startBluetoothDevicesDiscovery({
          allowDuplicatesKey: false,
          success: function() {
            that.log('正在扫描设备...');
            
            setTimeout(function() {
              wx.getBluetoothDevices({
                success: function(res) {
                  that.log('发现 ' + res.devices.length + ' 个设备');
                  that.setData({
                    devices: res.devices,
                    scanning: false
                  });
                  wx.stopBluetoothDevicesDiscovery();
                },
                fail: function(err) {
                  that.log('获取设备失败: ' + err.errMsg);
                  that.setData({ scanning: false });
                }
              });
            }, 8000);
          },
          fail: function(err) {
            that.log('扫描失败: ' + err.errMsg);
            that.setData({ scanning: false });
          }
        });
      },
      fail: function(err) {
        that.log('蓝牙初始化失败');
        wx.showModal({
          title: '错误',
          content: '请开启手机蓝牙',
          showCancel: false
        });
        that.setData({ scanning: false });
      }
    });
  },

  connectDevice: function(e) {
    var that = this;
    var deviceId = e.currentTarget.dataset.id;
    var device = this.data.devices.find(function(d) { return d.deviceId === deviceId; });
    
    wx.stopBluetoothDevicesDiscovery();
    that.setData({ debugLog: '' });
    that.log('连接设备: ' + (device.name || device.localName || deviceId));
    
    ble.connect(deviceId, function(success, err) {
      if (success) {
        ble.nodeName = device.name || device.localName || 'Meshtastic';
        that.setData({
          connected: true,
          deviceName: ble.nodeName
        });
        that.log('连接成功!');
        
        // 启用通知
        ble.enableNotify();
        
        wx.showToast({ title: '已连接', icon: 'success' });
      } else {
        that.log('连接失败: ' + err);
        wx.showToast({ title: '连接失败', icon: 'none' });
      }
    });
  },

  disconnect: function() {
    var that = this;
    wx.showModal({
      title: '断开连接',
      content: '确定断开？',
      success: function(res) {
        if (res.confirm) {
          ble.disconnect(function() {
            that.setData({
              connected: false,
              deviceName: '',
              debugLog: ''
            });
            wx.showToast({ title: '已断开', icon: 'success' });
          });
        }
      }
    });
  }
});