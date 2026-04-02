Page({
  data: { channels: [
    { index: 0, name: 'LongFast', enabled: true },
    { index: 1, name: 'MediumFast', enabled: false },
    { index: 2, name: 'ShortTurbo', enabled: false }
  ]},
  toggleChannel(e) {
    const index = e.currentTarget.dataset.index;
    const channels = this.data.channels;
    channels[index].enabled = !channels[index].enabled;
    this.setData({ channels });
  }
});