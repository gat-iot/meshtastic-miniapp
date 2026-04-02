Page({
  data: {
    messages: [],
    inputText: '',
    isConnected: false
  },

  onShow: function() {
    var app = getApp();
    this.setData({
      isConnected: !!app.globalData.deviceId && app.globalData.isConnected
    });
    console.log('消息页面 - 连接状态:', this.data.isConnected);
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

    var msg = {
      id: Date.now(),
      type: 'sent',
      text: this.data.inputText,
      time: new Date().toLocaleTimeString()
    };

    this.setData({
      messages: this.data.messages.concat(msg),
      inputText: ''
    });

    wx.showToast({ title: '消息已发送', icon: 'success' });
  }
});