Page({
  data: { messages: [], inputText: '', connected: false },
  onShow() {
    this.setData({ connected: !!getApp().globalData.deviceId });
  },
  sendMessage() {
    if (!this.data.inputText.trim() || !this.data.connected) return;
    const msg = { id: Date.now(), type: 'sent', text: this.data.inputText, time: new Date().toLocaleTimeString() };
    this.setData(prev => ({ messages: [...prev.messages, msg], inputText: '' }));
  },
  onInput(e) { this.setData({ inputText: e.detail.value }); }
});