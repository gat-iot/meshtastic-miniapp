// app.js - Meshtastic 微信小程序入口
App({
  globalData: {
    connectedDevice: null,
    deviceId: null,
    deviceInfo: null,
    nodes: [],
    messages: [],
    channels: []
  },

  onLaunch() {
    console.log('[App] Meshtastic MiniApp 启动')
    this.initBLE()
  },

  // 初始化蓝牙适配器
  initBLE() {
    wx.openBluetoothAdapter({
      success: (res) => {
        console.log('[BLE] 蓝牙适配器初始化成功', res)
        this.globalData.bluetoothAvailable = true
      },
      fail: (err) => {
        console.error('[BLE] 蓝牙适配器初始化失败', err)
        this.globalData.bluetoothAvailable = false
        wx.showModal({
          title: '蓝牙未开启',
          content: '请开启手机蓝牙后重试',
          showCancel: false
        })
      }
    })
  },

  // 断开设备连接
  disconnectDevice() {
    if (this.globalData.deviceId) {
      wx.closeBLEConnection({
        deviceId: this.globalData.deviceId,
        complete: () => {
          this.globalData.connectedDevice = null
          this.globalData.deviceId = null
          this.globalData.deviceInfo = null
          console.log('[BLE] 已断开设备连接')
        }
      })
    }
  },

  // 添加消息
  addMessage(msg) {
    this.globalData.messages.push({
      ...msg,
      timestamp: Date.now()
    })
    // 通知消息页面更新
    if (this.messageCallback) {
      this.messageCallback(msg)
    }
  },

  // 更新节点列表
  updateNodes(nodes) {
    this.globalData.nodes = nodes
    if (this.nodesCallback) {
      this.nodesCallback(nodes)
    }
  }
})
