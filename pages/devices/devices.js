var ble = require('../../utils/ble');

Page({
  data: {
    scanning: false,
    devices: [],
    connected: false,
    deviceName: '',
    error: ''
  },

  onShow: function() {
    this.setData({
      connected: ble.connected,
      deviceName: ble.nodeName || ''
    });
  },

  scanDevices: function() {
    var that = this;
    that.setData({ scanning: true, error: '', devices: [] });

    wx.openBluetoothAdapter({
      success: function() {
        wx.startBluetoothDevicesDiscovery({
          allowDuplicatesKey: false,
          success: function() {
            wx.showToast({ title: '扫描中...', icon: 'none' });

            setTimeout(function() {
              wx.getBluetoothDevices({
                success: function(res) {
                  console.log('[SCAN] 发现设备:', res.devices.length);
                  that.setData({
                    devices: res.devices,
                    scanning: false
                  });
                  wx.stopBluetoothDevicesDiscovery();
                },
                fail: function() {
                  that.setData({ scanning: false, error: '获取设备列表失败' });
                  wx.stopBluetoothDevicesDiscovery();
                }
              });
            }, 8000);
          },
          fail: function() {
            that.setData({ scanning: false, error: '扫描启动失败' });
          }
        });
      },
      fail: function(err) {
        that.setData({ scanning: false });
        wx.showModal({
          title: '蓝牙错误',
          content: '请开启手机蓝牙后重试',
          showCancel: false
        });
      }
    });
  },

  connectDevice: function(e) {
    var that = this;
    var deviceId = e.currentTarget.dataset.id;
    var device = this.data.devices.find(function(d) { return d.deviceId === deviceId; });

    wx.stopBluetoothDevicesDiscovery();

    ble.connect(deviceId, function(success, err) {
      if (success) {
        ble.nodeName = device.name || device.localName || 'Meshtastic';
        that.setData({
          connected: true,
          deviceName: ble.nodeName,
          devices: []
        });
        wx.showToast({ title: '已连接', icon: 'success' });
      } else {
        that.setData({ error: err || '连接失败' });
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
            that.setData({ connected: false, deviceName: '' });
            wx.showToast({ title: '已断开', icon: 'success' });
          });
        }
      }
    });
  }
});