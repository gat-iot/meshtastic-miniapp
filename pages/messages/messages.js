var ble = require('../../utils/ble');

Page({
  data: {
    messages: [],
    inputText: '',
    isConnected: false
  },

  onShow: function() {
    this.setData({
      isConnected: ble.isConnected
    });
    
    // 加载全局消息
    var app = getApp();
    if (app.globalData.messages.length !== this.data.messages.length) {
      this.setData({ messages: app.globalData.messages });
    }
  },

  onInput: function(e) {
    this.setData({ inputText: e.detail.value });
  },

  sendMessage: function() {
    if (!this.data.inputText.trim()) {
      wx.showToast({ title: '请输入消息', icon: 'none' });
      return;
    }
    if (!this.data.isConnected) {
      wx.showToast({ title: '请先连接设备', icon: 'none' });
      return;
    }

    var text = this.data.inputText.trim();
    var that = this;

    // 发送消息到设备
    ble.sendText(text, function(result) {
      var msg = {
        id: Date.now(),
        type: 'sent',
        text: text,
        time: new Date().toLocaleTimeString()
      };

      // 添加到列表
      that.setData({
        messages: that.data.messages.concat(msg),
        inputText: ''
      });

      // 保存到全局
      getApp().globalData.messages.push(msg);

      if (result.success) {
        wx.showToast({ title: '已发送', icon: 'success' });
      } else {
        wx.showToast({ title: '发送失败', icon: 'none' });
      }
    });
  }
});