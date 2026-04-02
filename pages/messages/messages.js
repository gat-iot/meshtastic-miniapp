var ble = require('../../utils/ble');

Page({
  data: {
    messages: [],
    inputText: '',
    connected: false
  },

  onShow: function() {
    this.setData({ connected: ble.connected });
    this._loadMessages();
  },

  _loadMessages: function() {
    var app = getApp();
    this.setData({ messages: app.globalData.messages.slice() });
  },

  onInput: function(e) {
    this.setData({ inputText: e.detail.value });
  },

  sendMessage: function() {
    if (!this.data.inputText.trim()) {
      wx.showToast({ title: '请输入消息', icon: 'none' });
      return;
    }
    if (!this.data.connected) {
      wx.showToast({ title: '请先连接设备', icon: 'none' });
      return;
    }

    var text = this.data.inputText.trim();
    var that = this;

    var msg = {
      id: Date.now(),
      type: 'sent',
      text: text,
      time: new Date().toLocaleTimeString()
    };
    this.setData({
      messages: this.data.messages.concat(msg),
      inputText: ''
    });
    getApp().globalData.messages.push(msg);

    ble.sendText(text, function(success, err) {
      if (!success) {
        console.error('发送失败:', err);
      }
    });
  }
});