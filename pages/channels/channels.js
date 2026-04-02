Page({
  data: {
    channels: [
      { index: 0, name: 'LongFast', enabled: true, desc: '远距离、低速率' },
      { index: 1, name: 'MediumFast', enabled: false, desc: '中等距离和速率' },
      { index: 2, name: 'ShortTurbo', enabled: false, desc: '短距离、高速率' }
    ],
    connected: false
  },

  onShow: function() {
    var ble = require('../../utils/ble');
    this.setData({ connected: ble.connected });
  },

  toggleChannel: function(e) {
    var index = e.currentTarget.dataset.index;
    var channels = this.data.channels;
    channels[index].enabled = !channels[index].enabled;
    this.setData({ channels: channels });
    wx.showToast({
      title: channels[index].enabled ? '已启用' : '已禁用',
      icon: 'success'
    });
  }
});