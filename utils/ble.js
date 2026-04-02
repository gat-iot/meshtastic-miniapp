// Meshtastic BLE 通信模块 (完整协议实现)
// 协议: https://meshtastic.org/docs/developers/protocol/ble

var pb = require('./protobuf');

// Meshtastic 标准 UUID
var MESH_SERVICE_UUID = '6BA1B218-15A8-461F-9CB8-2B72F03B19E4';
var TORADIO_UUID = 'F75C76D2-129E-4DAD-A1DD-7866124461DE';
var FROMRADIO_UUID = '2C55E69E-4993-11ED-BD78-0242AC120002';

var ble = {
  // 连接状态
  deviceId: null,
  serviceId: null,
  toRadioChar: null,
  fromRadioChar: null,
  connected: false,
  nodeId: null,
  nodeName: null,

  // 消息回调
  onMessage: null,
  onConnect: null,
  onDisconnect: null,

  // 发送队列 (用于分片大消息)
  _sendQueue: [],
  _sending: false,
  _packetId: 1,

  // 初始化 (必须在 app.js onLaunch 调用)
  init: function() {
    var that = this;
    
    // 监听 BLE 数据
    wx.onBLECharacteristicValueChange(function(res) {
      that._onData(res);
    });

    // 监听连接状态变化
    wx.onBLEConnectionStateChange(function(res) {
      console.log('[BLE] 连接状态变化:', res.connected);
      if (!res.connected) {
        that._reset();
        if (that.onDisconnect) that.onDisconnect();
      }
    });
  },

  // 连接设备
  connect: function(deviceId, callback) {
    var that = this;
    
    console.log('[BLE] 开始连接:', deviceId);
    wx.showLoading({ title: '连接中...', mask: true });

    // Step 1: 创建 BLE 连接
    wx.createBLEConnection({
      deviceId: deviceId,
      timeout: 15000,
      success: function() {
        that.deviceId = deviceId;
        console.log('[BLE] 连接建立');
        
        // Step 2: 延迟发现服务 (设备需要准备时间)
        setTimeout(function() {
          that._discoverServices(callback);
        }, 1000);
      },
      fail: function(err) {
        wx.hideLoading();
        console.error('[BLE] 连接失败:', err);
        that._reset();
        callback && callback(false, '连接失败: ' + err.errMsg);
      }
    });
  },

  _discoverServices: function(callback) {
    var that = this;

    wx.getBLEDeviceServices({
      deviceId: this.deviceId,
      success: function(res) {
        console.log('[BLE] 发现服务:', res.services.length);
        
        // 查找 Meshtastic 服务
        var meshService = null;
        for (var i = 0; i < res.services.length; i++) {
          var uuid = res.services[i].uuid.toUpperCase();
          if (uuid.indexOf('6BA1B218') >= 0 || uuid.indexOf('6BA1B218') >= 0) {
            meshService = res.services[i];
            break;
          }
        }

        if (!meshService && res.services.length > 0) {
          // 尝试第一个服务
          meshService = res.services[0];
          console.log('[BLE] 使用第一个服务:', meshService.uuid);
        }

        if (!meshService) {
          wx.hideLoading();
          callback && callback(false, '未找到蓝牙服务');
          return;
        }

        that.serviceId = meshService.uuid;
        
        // Step 3: 发现特征值
        setTimeout(function() {
          that._discoverCharacteristics(callback);
        }, 500);
      },
      fail: function(err) {
        wx.hideLoading();
        callback && callback(false, '服务发现失败');
      }
    });
  },

  _discoverCharacteristics: function(callback) {
    var that = this;

    wx.getBLEDeviceCharacteristics({
      deviceId: this.deviceId,
      serviceId: this.serviceId,
      success: function(res) {
        console.log('[BLE] 发现特征值:', res.characteristics.length);
        
        // 遍历特征值
        for (var i = 0; i < res.characteristics.length; i++) {
          var c = res.characteristics[i];
          var uuid = c.uuid.toUpperCase();
          var props = c.properties;

          console.log('[BLE] 特征值:', uuid.slice(0, 8), '写:', !!props.write, '通知:', !!props.notify);

          // ToRadio (发送)
          if ((uuid.indexOf('F75C76D2') >= 0 || uuid.indexOf('f75c76d2') >= 0) && (props.write || props.writeNoResponse)) {
            that.toRadioChar = c.uuid;
            console.log('[BLE] 找到 ToRadio');
          }
          
          // FromRadio (接收)
          if ((uuid.indexOf('2C55E69E') >= 0 || uuid.indexOf('2c55e69e') >= 0) && (props.notify || props.indicate)) {
            that.fromRadioChar = c.uuid;
            console.log('[BLE] 找到 FromRadio');
          }
        }

        // 备选: 根据属性自动选择
        if (!that.toRadioChar) {
          for (var j = 0; j < res.characteristics.length; j++) {
            var c2 = res.characteristics[j];
            if (c2.properties.write || c2.properties.writeNoResponse) {
              that.toRadioChar = c2.uuid;
              console.log('[BLE] 备选 ToRadio:', c2.uuid);
              break;
            }
          }
        }

        if (!that.fromRadioChar) {
          for (var k = 0; k < res.characteristics.length; k++) {
            var c3 = res.characteristics[k];
            if (c3.properties.notify || c3.properties.indicate) {
              that.fromRadioChar = c3.uuid;
              console.log('[BLE] 备选 FromRadio:', c3.uuid);
              break;
            }
          }
        }

        // Step 4: 启用通知
        if (that.fromRadioChar) {
          that._enableNotify(callback);
        } else {
          // 没有通知特征值，直接认为连接成功
          that.connected = true;
          wx.hideLoading();
          callback && callback(true);
        }
      },
      fail: function(err) {
        wx.hideLoading();
        callback && callback(false, '特征值发现失败');
      }
    });
  },

  _enableNotify: function(callback) {
    var that = this;

    wx.notifyBLECharacteristicValueChange({
      deviceId: this.deviceId,
      serviceId: this.serviceId,
      characteristicId: this.fromRadioChar,
      state: true,
      success: function() {
        console.log('[BLE] 通知已启用 - 连接完成');
        that.connected = true;
        wx.hideLoading();
        callback && callback(true);
      },
      fail: function(err) {
        console.error('[BLE] 启用通知失败:', err);
        // 仍然标记为已连接 (可能某些设备不需要通知)
        that.connected = true;
        wx.hideLoading();
        callback && callback(true);
      }
    });
  },

  // 处理接收到的数据
  _onData: function(res) {
    if (!this.connected) return;

    console.log('[BLE] 收到数据, 特征值:', res.characteristicId.slice(0, 8));

    // 解析 FromRadio 数据
    var parsed = pb.parseFromRadio(res.value);
    console.log('[BLE] 解析结果:', parsed.type, parsed.data);

    // 回调到应用层
    if (this.onMessage) {
      this.onMessage(parsed);
    }
  },

  // 发送文本消息
  sendText: function(text, callback) {
    if (!this.connected || !this.toRadioChar) {
      callback && callback(false, '未连接设备');
      return false;
    }

    var packet = pb.buildTextPacket(text, 0xFFFFFFFF, this._packetId++);
    this._writePacket(packet, callback);
    return true;
  },

  // 发送数据包
  _writePacket: function(packet, callback) {
    var that = this;
    var buffer = new Uint8Array(packet).buffer;

    console.log('[BLE] 发送数据包, 长度:', packet.length);

    wx.writeBLECharacteristicValue({
      deviceId: this.deviceId,
      serviceId: this.serviceId,
      characteristicId: this.toRadioChar,
      value: buffer,
      success: function() {
        console.log('[BLE] 发送成功');
        callback && callback(true);
      },
      fail: function(err) {
        console.error('[BLE] 发送失败:', err);
        callback && callback(false, err.errMsg);
      }
    });
  },

  // 断开连接
  disconnect: function(callback) {
    var that = this;

    if (this.deviceId) {
      wx.closeBLEConnection({
        deviceId: this.deviceId,
        complete: function() {
          that._reset();
          callback && callback();
        }
      });
    } else {
      this._reset();
      callback && callback();
    }
  },

  // 重置状态
  _reset: function() {
    this.deviceId = null;
    this.serviceId = null;
    this.toRadioChar = null;
    this.fromRadioChar = null;
    this.connected = false;
    this.nodeId = null;
    this.nodeName = null;
    this._packetId = 1;
  },

  // 获取连接状态
  getState: function() {
    return {
      connected: this.connected,
      deviceId: this.deviceId,
      nodeId: this.nodeId,
      nodeName: this.nodeName
    };
  }
};

module.exports = ble;