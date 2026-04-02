// Meshtastic BLE 调试版
// 添加详细日志追踪发送和接收

var MESH_SERVICE_UUID = '6BA1B218-15A8-461F-9CB8-2B72F03B19E4';
var TORADIO_UUID = 'F75C76D2-129E-4DAD-A1DD-7866124461DE';
var FROMRADIO_UUID = '2C55E69E-4993-11ED-BD78-0242AC120002';

var ble = {
  deviceId: null,
  serviceId: null,
  toRadioChar: null,
  fromRadioChar: null,
  connected: false,
  nodeName: null,
  
  onMessage: null,
  onConnect: null,
  onDisconnect: null,

  init: function() {
    var that = this;
    
    wx.onBLECharacteristicValueChange(function(res) {
      console.log('[BLE] ★ 收到数据变化, char:', res.characteristicId);
      console.log('[BLE] 数据长度:', res.value.byteLength);
      
      // 转换为 hex 字符串
      var hex = that._ab2hex(res.value);
      console.log('[BLE] 数据(hex):', hex);
      
      // 尝试解析
      that._parseData(res.value);
    });

    wx.onBLEConnectionStateChange(function(res) {
      console.log('[BLE] ★ 连接状态变化:', res.connected ? '已连接' : '断开');
      if (!res.connected) {
        that._reset();
        if (that.onDisconnect) that.onDisconnect();
      }
    });
  },

  connect: function(deviceId, callback) {
    var that = this;
    console.log('[BLE] 开始连接设备:', deviceId);
    
    wx.showLoading({ title: '连接中...', mask: true });

    wx.createBLEConnection({
      deviceId: deviceId,
      timeout: 15000,
      success: function() {
        console.log('[BLE] ✓ 连接建立成功');
        that.deviceId = deviceId;
        setTimeout(function() { that._discoverServices(callback); }, 1500);
      },
      fail: function(err) {
        wx.hideLoading();
        console.error('[BLE] ✗ 连接失败:', err);
        callback && callback(false, '连接失败');
      }
    });
  },

  _discoverServices: function(callback) {
    var that = this;
    
    wx.getBLEDeviceServices({
      deviceId: this.deviceId,
      success: function(res) {
        console.log('[BLE] 发现', res.services.length, '个服务');
        
        // 打印所有服务 UUID
        res.services.forEach(function(s, i) {
          console.log('[BLE] 服务' + i + ':', s.uuid);
        });
        
        // 找 Meshtastic 服务
        var meshService = null;
        for (var i = 0; i < res.services.length; i++) {
          var uuid = res.services[i].uuid.toUpperCase();
          if (uuid.indexOf('6BA1B218') >= 0) {
            meshService = res.services[i];
            break;
          }
        }
        
        // 如果没找到，用第一个服务
        if (!meshService && res.services.length > 0) {
          meshService = res.services[0];
          console.log('[BLE] 使用第一个服务:', meshService.uuid);
        }
        
        if (!meshService) {
          wx.hideLoading();
          callback && callback(false, '未找到服务');
          return;
        }
        
        that.serviceId = meshService.uuid;
        console.log('[BLE] 使用服务:', that.serviceId);
        setTimeout(function() { that._discoverCharacteristics(callback); }, 500);
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
        console.log('[BLE] 发现', res.characteristics.length, '个特征值');
        
        // 打印所有特征值
        res.characteristics.forEach(function(c, i) {
          var props = [];
          if (c.properties.read) props.push('读');
          if (c.properties.write) props.push('写');
          if (c.properties.writeNoResponse) props.push('写无响应');
          if (c.properties.notify) props.push('通知');
          if (c.properties.indicate) props.push('指示');
          console.log('[BLE] 特征' + i + ':', c.uuid, '[' + props.join(',') + ']');
        });
        
        // 找 ToRadio 和 FromRadio
        for (var i = 0; i < res.characteristics.length; i++) {
          var c = res.characteristics[i];
          var uuid = c.uuid.toUpperCase();
          
          // ToRadio - 需要可写
          if (uuid.indexOf('F75C76D2') >= 0) {
            that.toRadioChar = c.uuid;
            console.log('[BLE] ✓ 找到 ToRadio:', c.uuid, '写:', !!c.properties.write, '写无响应:', !!c.properties.writeNoResponse);
          }
          
          // FromRadio - 需要可通知
          if (uuid.indexOf('2C55E69E') >= 0) {
            that.fromRadioChar = c.uuid;
            console.log('[BLE] ✓ 找到 FromRadio:', c.uuid, '通知:', !!c.properties.notify);
          }
        }
        
        // 备选: 如果没找到，使用第一个可写的
        if (!that.toRadioChar) {
          for (var i = 0; i < res.characteristics.length; i++) {
            var c = res.characteristics[i];
            if (c.properties.write || c.properties.writeNoResponse) {
              that.toRadioChar = c.uuid;
              console.log('[BLE] 使用备选 ToRadio:', c.uuid);
              break;
            }
          }
        }
        
        if (!that.fromRadioChar) {
          for (var i = 0; i < res.characteristics.length; i++) {
            var c = res.characteristics[i];
            if (c.properties.notify || c.properties.indicate) {
              that.fromRadioChar = c.uuid;
              console.log('[BLE] 使用备选 FromRadio:', c.uuid);
              break;
            }
          }
        }
        
        console.log('[BLE] ToRadio:', that.toRadioChar || '未找到');
        console.log('[BLE] FromRadio:', that.fromRadioChar || '未找到');
        
        // 启用通知
        if (that.fromRadioChar) {
          that._enableNotify(callback);
        } else {
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
    
    console.log('[BLE] 启用通知:', this.fromRadioChar);
    
    wx.notifyBLECharacteristicValueChange({
      deviceId: this.deviceId,
      serviceId: this.serviceId,
      characteristicId: this.fromRadioChar,
      state: true,
      success: function() {
        console.log('[BLE] ✓ 通知已启用 - 连接完成');
        that.connected = true;
        wx.hideLoading();
        callback && callback(true);
      },
      fail: function(err) {
        console.error('[BLE] ✗ 启用通知失败:', err);
        // 仍然标记为已连接
        that.connected = true;
        wx.hideLoading();
        callback && callback(true);
      }
    });
  },

  _parseData: function(buffer) {
    var bytes = new Uint8Array(buffer);
    console.log('[BLE] 解析数据, 长度:', bytes.length);
    
    // 简单解析: 尝试提取文本
    if (bytes.length > 3) {
      // 检查是否是文本消息 (portnum 1 = TEXT_MESSAGE)
      // 格式通常是: [tag][len][data][tag][len][data]...
      var text = '';
      try {
        text = String.fromCharCode.apply(null, bytes);
        // 只显示可打印字符
        text = text.replace(/[^\x20-\x7E\n]/g, '');
        if (text.length > 0) {
          console.log('[BLE] 原始文本:', text);
        }
      } catch (e) {
        console.log('[BLE] 非文本数据');
      }
    }
    
    if (this.onMessage) {
      this.onMessage({ type: 'raw', data: buffer });
    }
  },

  // 发送文本消息 - 简化版
  sendText: function(text, callback) {
    if (!this.connected || !this.toRadioChar) {
      console.error('[BLE] 未连接或无发送通道');
      callback && callback(false, '未连接');
      return;
    }
    
    console.log('[BLE] 准备发送文本:', text);
    console.log('[BLE] ToRadio特征值:', this.toRadioChar);
    console.log('[BLE] ServiceUUID:', this.serviceId);
    
    // 尝试不同的发送方式
    this._sendAsProtobuf(text, callback);
  },

  // 方式1: 作为 Protobuf 发送 (完整格式)
  _sendAsProtobuf: function(text, callback) {
    var that = this;
    var packet = this._buildMeshPacket(text);
    var buffer = new Uint8Array(packet).buffer;
    
    console.log('[BLE] 发送Protobuf, 长度:', packet.length, '字节');
    console.log('[BLE] 数据(hex):', this._ab2hex(buffer));
    
    wx.writeBLECharacteristicValue({
      deviceId: this.deviceId,
      serviceId: this.serviceId,
      characteristicId: this.toRadioChar,
      value: buffer,
      success: function() {
        console.log('[BLE] ✓ 发送成功 (Protobuf方式)');
        callback && callback(true);
      },
      fail: function(err) {
        console.error('[BLE] ✗ 发送失败 (Protobuf):', err);
        // 尝试备选方式
        that._sendAsRawText(text, callback);
      }
    });
  },

  // 备选: 发送原始文本
  _sendAsRawText: function(text, callback) {
    var that = this;
    var buffer = new Uint8Array(text.length);
    for (var i = 0; i < text.length; i++) {
      buffer[i] = text.charCodeAt(i);
    }
    
    console.log('[BLE] 发送原始文本, 长度:', text.length);
    
    wx.writeBLECharacteristicValue({
      deviceId: this.deviceId,
      serviceId: this.serviceId,
      characteristicId: this.toRadioChar,
      value: buffer.buffer,
      success: function() {
        console.log('[BLE] ✓ 发送成功 (原始文本方式)');
        callback && callback(true);
      },
      fail: function(err) {
        console.error('[BLE] ✗ 发送失败 (原始文本):', err);
        callback && callback(false, err.errMsg);
      }
    });
  },

  // 构建 MeshPacket (简化版 protobuf)
  _buildMeshPacket: function(text) {
    // 文本作为 UTF-8
    var textBytes = [];
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      if (c < 0x80) {
        textBytes.push(c);
      } else if (c < 0x800) {
        textBytes.push(0xC0 | (c >> 6));
        textBytes.push(0x80 | (c & 0x3F));
      } else {
        textBytes.push(0xE0 | (c >> 12));
        textBytes.push(0x80 | ((c >> 6) & 0x3F));
        textBytes.push(0x80 | (c & 0x3F));
      }
    }
    
    // DecodedMeshPacket.payload (field 2, wire type 2)
    var payload = [0x0A]; // field 2, wire type 2
    payload = payload.concat(this._encodeVarint(textBytes.length));
    payload = payload.concat(textBytes);
    
    // DecodedMeshPacket.portnum = TEXT_MESSAGE_APP (1)
    var portNum = [0x08, 0x01]; // field 1, wire type 0, value 1
    
    // DecodedMeshPacket = portnum + payload
    var decoded = portNum.concat(payload);
    
    // DecodedMeshPacket wrapper (field 101, wire type 2)
    var decodedWrapper = [0xFE, 0x06]; // field 101 (13 << 3 | 2 = 106 = 0x6A... wait)
    // field 101: 101 << 3 | 2 = 808 | 2 = 810... 
    // 101 = 0x65, 0x65 << 3 = 0x328, | 2 = 0x32A
    // 0x32A = 0xFE 0x06 (varint 810)
    decodedWrapper = decodedWrapper.concat(this._encodeVarint(decoded.length));
    decodedWrapper = decodedWrapper.concat(decoded);
    
    // MeshPacket.to = broadcast (0xFFFFFFFF, field 2, wire type 5)
    var toField = [0x11, 0xFF, 0xFF, 0xFF, 0xFF]; // field 2, wire type 5, value 0xFFFFFFFF
    
    // MeshPacket.id (field 3, varint)
    var idField = [0x18, 0x01]; // field 3, wire type 0, value 1
    
    // MeshPacket.hop_limit (field 9, varint)
    var hopField = [0x48, 0x00]; // field 9, wire type 0, value 0
    
    // MeshPacket.decoded (field 101, wire type 2)
    var decodedField = [0xFE, 0x06];
    decodedField = decodedField.concat(this._encodeVarint(decodedWrapper.length));
    decodedField = decodedField.concat(decodedWrapper);
    
    // ToRadio.packet (field 2, wire type 2)
    var toRadioPacket = [0x12]; // field 2, wire type 2
    var packetLen = toField.length + idField.length + hopField.length + decodedField.length;
    toRadioPacket = toRadioPacket.concat(this._encodeVarint(packetLen));
    toRadioPacket = toRadioPacket.concat(toField).concat(idField).concat(hopField).concat(decodedField);
    
    console.log('[BLE] 构建数据包完成, 长度:', toRadioPacket.length);
    return toRadioPacket;
  },

  // 编码 varint
  _encodeVarint: function(value) {
    var bytes = [];
    value = value >>> 0;
    while (value > 0) {
      var b = value & 0x7F;
      value = value >>> 7;
      if (value > 0) b = b | 0x80;
      bytes.push(b);
    }
    if (bytes.length === 0) bytes = [0];
    return bytes;
  },

  // ArrayBuffer 转 Hex
  _ab2hex: function(buffer) {
    var hex = '';
    var view = new DataView(buffer);
    for (var i = 0; i < view.byteLength; i++) {
      hex += ('00' + view.getUint8(i).toString(16)).slice(-2) + ' ';
    }
    return hex.trim();
  },

  disconnect: function() {
    if (this.deviceId) {
      wx.closeBLEConnection({ deviceId: this.deviceId });
    }
    this._reset();
  },

  _reset: function() {
    this.deviceId = null;
    this.serviceId = null;
    this.toRadioChar = null;
    this.fromRadioChar = null;
    this.connected = false;
    this.nodeName = null;
  }
};

module.exports = ble;