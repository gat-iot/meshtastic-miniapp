// app.js - Meshtastic 微信小程序入口
App({
  globalData: {
    connectedDevice: null,
    deviceId: null,
    deviceInfo: null,
    nodes: [],
    messages: [],
    channels: []
  },

  onLaunch() {
    console.log('[App] Meshtastic MiniApp 启动');
    this.initBLE();
  },

  initBLE() {
    wx.openBluetoothAdapter({
      success: () => {
        console.log('[BLE] 蓝牙适配器初始化成功');
        this.globalData.bluetoothAvailable = true;
      },
      fail: (err) => {
        console.error('[BLE] 蓝牙适配器初始化失败', err);
        this.globalData.bluetoothAvailable = false;
        wx.showModal({
          title: '蓝牙未开启',
          content: '请开启手机蓝牙后重试',
          showCancel: false
        });
      }
    });
  },

  disconnectDevice() {
    if (this.globalData.deviceId) {
      wx.closeBLEConnection({
        deviceId: this.globalData.deviceId,
        complete: () => {
          this.globalData.connectedDevice = null;
          this.globalData.deviceId = null;
          this.globalData.deviceInfo = null;
        }
      });
    }
  },

  addMessage(msg) {
    this.globalData.messages.push({ ...msg, timestamp: Date.now() });
  },

  updateNodes(nodes) {
    this.globalData.nodes = nodes;
  }
});