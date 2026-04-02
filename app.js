var ble = require('./utils/ble');

App({
  globalData: {
    messages: []
  },

  onLaunch: function() {
    console.log('Meshtastic MiniApp 启动');
    // 初始化 BLE 监听
    ble.init();
    
    // 设置消息回调
    ble.onMessage = function(parsed) {
      if (parsed.type === 'packet' && parsed.data.text) {
        this.globalData.messages.push({
          id: Date.now(),
          type: 'received',
          text: parsed.data.text,
          time: new Date().toLocaleTimeString(),
          from: parsed.data.from
        });
      }
    }.bind(this);
  }
});