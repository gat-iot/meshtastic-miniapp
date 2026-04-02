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
    if (ble.connected && ble.fromRadioChar) {
      ble.enableNotify();
    }
  },

  addLog: function(msg) {
    this.setData({ debugLog: this.data.debugLog + msg + '\n' });
  },

  scanDevices: function() {
    var that = this;
    that.setData({ scanning: true, devices: [], debugLog: '' });
    that.addLog('开始扫描...');

    wx.openBluetoothAdapter({
      success: function() {
        that.addLog('蓝牙已开启');

        wx.startBluetoothDevicesDiscovery({
          allowDuplicatesKey: false,
          success: function() {
            that.addLog('扫描中...');

            setTimeout(function() {
              wx.getBluetoothDevices({
                success: function(res) {
                  that.addLog('发现 ' + res.devices.length + ' 个设备');
                  for (var i = 0; i < res.devices.length; i++) {
                    var d = res.devices[i];
                    that.addLog('  ' + (d.name || d.localName || '?') + ' RSSI:' + d.RSSI);
                  }
                  that.setData({ devices: res.devices, scanning: false });
                  wx.stopBluetoothDevicesDiscovery();
                },
                fail: function(err) {
                  that.addLog('获取设备失败');
                  that.setData({ scanning: false });
                }
              });
            }, 8000);
          },
          fail: function(err) {
            that.addLog('扫描失败');
            that.setData({ scanning: false });
          }
        });
      },
      fail: function() {
        that.addLog('请开启蓝牙');
        wx.showModal({ title: '提示', content: '请开启手机蓝牙', showCancel: false });
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
    that.addLog('连接: ' + (device.name || device.localName || '?'));

    ble.connect(deviceId, function(success, err) {
      if (success) {
        ble.nodeName = device.name || device.localName || 'Meshtastic';
        that.setData({ connected: true, deviceName: ble.nodeName });
        that.addLog('连接成功!');

        ble.enableNotify();
        wx.showToast({ title: '已连接', icon: 'success' });
      } else {
        that.addLog('失败: ' + (err || ''));
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
            that.setData({ connected: false, deviceName: '', debugLog: '' });
            wx.showToast({ title: '已断开', icon: 'success' });
          });
        }
      }
    });
  }
});