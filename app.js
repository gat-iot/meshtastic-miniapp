App({
  globalData: {
    connectedDevice: null,
    deviceId: null,
    isConnected: false,
    serviceId: null,
    messages: []
  },

  onLaunch: function() {
    console.log('Meshtastic MiniApp 启动');
  },

  onShow: function() {
    console.log('App 显示');
  }
});