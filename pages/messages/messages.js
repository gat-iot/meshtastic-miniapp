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
    this.setData({ messages: getApp().globalData.messages.slice() });
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

    // 添加到界面
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

    // 通过 BLE 发送
    ble.sendText(text, function(success, err) {
      if (!success) {
        wx.showToast({ title: '发送失败', icon: 'none' });
        console.error('[MSG] 发送失败:', err);
      }
    });
  }
});