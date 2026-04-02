App({
  globalData: {
    connectedDevice: null,
    deviceId: null,
    isConnected: false,
    messages: []
  },
  onLaunch: function() {
    console.log('Meshtastic MiniApp 启动');
  }
});