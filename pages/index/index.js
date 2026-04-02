Page({
  data: { scanning: false, devices: [], connectedDevice: null },
  
  scanDevices() {
    this.setData({ scanning: true, devices: [] });
    wx.openBluetoothAdapter({
      success: () => {
        wx.startBluetoothDevicesDiscovery({
          services: ['6BA1B218-15A8-461F-9CB8-2B72F03B19E4'],
          success: () => {
            setTimeout(() => {
              wx.getBluetoothDevices({
                success: (res) => {
                  this.setData({ devices: res.devices, scanning: false });
                  wx.stopBluetoothDevicesDiscovery();
                }
              });
            }, 3000);
          }
        });
      },
      fail: () => {
        wx.showToast({ title: '请开启蓝牙', icon: 'none' });
        this.setData({ scanning: false });
      }
    });
  },
  
  connectDevice(e) {
    const deviceId = e.currentTarget.dataset.id;
    wx.createBLEConnection({
      deviceId: deviceId,
      success: () => {
        const device = this.data.devices.find(d => d.deviceId === deviceId);
        this.setData({ connectedDevice: device });
        getApp().globalData.deviceId = deviceId;
        getApp().globalData.connectedDevice = device;
        wx.showToast({ title: '连接成功', icon: 'success' });
      },
      fail: () => wx.showToast({ title: '连接失败', icon: 'error' })
    });
  },
  
  disconnect() {
    if (getApp().globalData.deviceId) {
      wx.closeBLEConnection({ deviceId: getApp().globalData.deviceId });
    }
    this.setData({ connectedDevice: null });
    getApp().globalData.deviceId = null;
  }
});