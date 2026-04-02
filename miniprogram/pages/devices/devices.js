// pages/devices/devices.js - 设备/节点列表页面
Page({
  data: {
    myDevice: null,
    nodes: [],
    connected: false
  },

  onLoad() {
    // 注册节点更新回调
    const app = getApp()
    app.nodesCallback = this.updateNodes.bind(this)
  },

  onShow() {
    this.loadDeviceInfo()
  },

  onUnload() {
    const app = getApp()
    app.nodesCallback = null
  },

  // 加载设备信息
  loadDeviceInfo() {
    const app = getApp()
    
    this.setData({
      myDevice: app.globalData.connectedDevice,
      connected: !!app.globalData.deviceId,
      nodes: app.globalData.nodes || []
    })
  },

  // 更新节点列表
  updateNodes(nodes) {
    this.setData({ nodes })
  },

  // 刷新节点列表
  refreshNodes() {
    // TODO: 从设备获取最新节点列表
    wx.showLoading({ title: '刷新中...' })
    
    setTimeout(() => {
      wx.hideLoading()
      wx.showToast({ title: '已刷新', icon: 'success' })
    }, 1000)
  },

  // 查看节点详情
  viewNodeDetail(e) {
    const { node } = e.currentTarget.dataset
    wx.showModal({
      title: node.shortName || '节点详情',
      content: `ID: ${node.id}\n名称: ${node.longName}\n位置: ${node.latitude || '未知'}, ${node.longitude || '未知'}`,
      showCancel: false
    })
  },

  // 跳转到连接页
  goToConnect() {
    wx.switchTab({ url: '/pages/index/index' })
  }
})
