Page({
  data: {
    scanning: false,
    devices: [],
    connectedDevice: null,
    isConnected: false,
    error: null,
    isSimulator: false
  },

  onLoad: function() {
    var that = this;
    wx.getSystemInfo({
      success: function(res) {
        if (res.platform === 'devtools') {
          that.setData({ isSimulator: true });
        }
      }
    });
  },

  onShow: function() {
    var app = getApp();
    if (app.globalData.deviceId && app.globalData.isConnected) {
      this.setData({
        connectedDevice: app.globalData.connectedDevice,
        isConnected: true
      });
    }
  },

  scanDevices: function() {
    var that = this;
    
    if (that.data.isSimulator) {
      wx.showModal({
        title: '模拟器不支持蓝牙',
        content: '请使用真机调试功能，在手机上测试。',
        showCancel: false
      });
      return;
    }
    
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
                  that.setData({ 
                    devices: res.devices, 
                    scanning: false 
                  });
                  
                  if (res.devices.length === 0) {
                    wx.showToast({ title: '未发现蓝牙设备', icon: 'none' });
                  }
                  
                  wx.stopBluetoothDevicesDiscovery({});
                },
                fail: function(err) {
                  that.setData({ scanning: false, error: '获取设备失败' });
                }
              });
            }, 10000);
          },
          fail: function(err) {
            that.setData({ scanning: false, error: '扫描失败' });
          }
        });
      },
      fail: function(err) {
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
    
    console.log('准备连接:', deviceId);
    wx.showLoading({ title: '连接中...' });
    
    // 先停止扫描
    wx.stopBluetoothDevicesDiscovery({});
    
    wx.createBLEConnection({
      deviceId: deviceId,
      timeout: 20000,
      success: function() {
        console.log('BLE连接成功');
        
        // 获取服务和特征值
        setTimeout(function() {
          wx.getBLEDeviceServices({
            deviceId: deviceId,
            success: function(res) {
              console.log('服务列表:', res.services);
              
              // 查找 Meshtastic 服务
              var meshService = res.services.find(function(s) {
                return s.uuid.toUpperCase().indexOf('6BA1B218') >= 0;
              });
              
              if (meshService) {
                console.log('找到 Meshtastic 服务:', meshService.uuid);
                
                // 获取特征值
                wx.getBLEDeviceCharacteristics({
                  deviceId: deviceId,
                  serviceId: meshService.uuid,
                  success: function(charRes) {
                    console.log('特征值:', charRes.characteristics);
                    
                    wx.hideLoading();
                    
                    // 保存连接状态
                    var app = getApp();
                    app.globalData.deviceId = deviceId;
                    app.globalData.connectedDevice = device;
                    app.globalData.isConnected = true;
                    app.globalData.serviceId = meshService.uuid;
                    
                    that.setData({
                      connectedDevice: device,
                      isConnected: true,
                      devices: []
                    });
                    
                    wx.showToast({ title: '连接成功', icon: 'success' });
                  },
                  fail: function(err) {
                    console.error('获取特征值失败:', err);
                    wx.hideLoading();
                    that.closeConnection(deviceId);
                    wx.showToast({ title: '连接失败', icon: 'none' });
                  }
                });
              } else {
                console.log('未找到 Meshtastic 服务，但已连接');
                wx.hideLoading();
                
                var app = getApp();
                app.globalData.deviceId = deviceId;
                app.globalData.connectedDevice = device;
                app.globalData.isConnected = true;
                
                that.setData({
                  connectedDevice: device,
                  isConnected: true,
                  devices: []
                });
                
                wx.showToast({ title: '连接成功', icon: 'success' });
              }
            },
            fail: function(err) {
              console.error('获取服务失败:', err);
              wx.hideLoading();
              that.closeConnection(deviceId);
              wx.showToast({ title: '连接失败', icon: 'none' });
            }
          });
        }, 1000);
      },
      fail: function(err) {
        console.error('连接失败:', err);
        wx.hideLoading();
        wx.showToast({ title: '连接失败', icon: 'none' });
      }
    });
  },

  closeConnection: function(deviceId) {
    wx.closeBLEConnection({ deviceId: deviceId });
  },

  disconnect: function() {
    var that = this;
    var deviceId = getApp().globalData.deviceId;
    
    if (deviceId) {
      wx.closeBLEConnection({
        deviceId: deviceId,
        success: function() {
          getApp().globalData.deviceId = null;
          getApp().globalData.connectedDevice = null;
          getApp().globalData.isConnected = false;
          that.setData({
            connectedDevice: null,
            isConnected: false
          });
          wx.showToast({ title: '已断开', icon: 'success' });
        }
      });
    }
  }
});