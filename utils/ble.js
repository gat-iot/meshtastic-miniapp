// Meshtastic 完整协议实现
// 基于 Meshtastic protobuf 定义

// Meshtastic 标准 BLE UUID (小写格式，微信会自动转换)
var MESH_SERVICE_UUID = '6ba1b218-15a8-461f-9cb8-2b72f03b19e4';
var TORADIO_CHAR_UUID = 'f75c76d2-129e-4dad-a1dd-7866124461de';
var FROMRADIO_CHAR_UUID = '2c55e69e-4993-11ed-bd78-0242ac120002';

// 端口号
var PortNum = {
  UNKNOWN_APP: 0,
  TEXT_MESSAGE_APP: 1,
  REMOTE_HARDWARE_APP: 2,
  POSITION_APP: 3,
  NODEINFO_APP: 4,
  ROUTING_APP: 5,
  ADMIN_APP: 6
};

var ble = {
  // 状态
  deviceId: null,
  serviceUUID: null,
  toRadioChar: null,
  fromRadioChar: null,
  connected: false,
  nodeName: null,
  myNodeNum: null,
  
  // 回调
  onMessage: null,
  onDisconnect: null,
  
  // 发送相关
  _packetId: 1,
  _characteristics: [],

  // 初始化
  init: function() {
    var that = this;
    
    // 监听 BLE 数据
    wx.onBLECharacteristicValueChange(function(res) {
      console.log('[BLE] 收到数据, 特征值:', res.characteristicId);
      var hex = that._buf2hex(res.value);
      console.log('[BLE] 数据 (hex):', hex);
      that._handleData(res.value, res.characteristicId);
    });

    // 监听连接状态
    wx.onBLEConnectionStateChange(function(res) {
      console.log('[BLE] 连接状态变化:', res.connected ? '已连接' : '断开');
      if (!res.connected) {
        that._reset();
        if (that.onDisconnect) that.onDisconnect();
      }
    });
    
    console.log('[BLE] 初始化完成');
  },

  // 连接设备
  connect: function(deviceId, callback) {
    var that = this;
    console.log('[BLE] ===== 开始连接 =====');
    console.log('[BLE] 设备ID:', deviceId);
    
    wx.showLoading({ title: '连接中...', mask: true });

    wx.createBLEConnection({
      deviceId: deviceId,
      timeout: 30000,
      success: function() {
        console.log('[BLE] BLE连接建立');
        that.deviceId = deviceId;
        
        // 延迟发现服务
        setTimeout(function() {
          that._discoverServices(callback);
        }, 2000);
      },
      fail: function(err) {
        wx.hideLoading();
        console.error('[BLE] 连接失败:', err);
        callback && callback({ success: false, error: err.errMsg });
      }
    });
  },

  // 发现服务
  _discoverServices: function(callback) {
    var that = this;
    
    wx.getBLEDeviceServices({
      deviceId: this.deviceId,
      success: function(res) {
        console.log('[BLE] ===== 服务列表 =====');
        console.log('[BLE] 服务数量:', res.services.length);
        
        var allServices = res.services;
        
        // 打印所有服务
        for (var i = 0; i < allServices.length; i++) {
          console.log('[BLE] 服务' + i + ':', allServices[i].uuid, 
            allServices[i].isPrimary ? '(主服务)' : '(从服务)');
        }
        
        // 找 Meshtastic 服务
        var meshService = null;
        for (var i = 0; i < allServices.length; i++) {
          var uuid = allServices[i].uuid.toLowerCase();
          if (uuid.indexOf('6ba1b218') >= 0) {
            meshService = allServices[i];
            console.log('[BLE] 找到 Meshtastic 服务');
            break;
          }
        }
        
        if (!meshService && allServices.length > 0) {
          meshService = allServices[0];
          console.log('[BLE] 使用第一个服务');
        }
        
        if (!meshService) {
          wx.hideLoading();
          callback && callback({ success: false, error: '未找到蓝牙服务' });
          return;
        }
        
        that.serviceUUID = meshService.uuid;
        console.log('[BLE] 使用服务:', that.serviceUUID);
        
        // 获取特征值
        that._discoverCharacteristics(callback);
      },
      fail: function(err) {
        wx.hideLoading();
        console.error('[BLE] 获取服务失败:', err);
        callback && callback({ success: false, error: '获取服务失败' });
      }
    });
  },

  // 发现特征值
  _discoverCharacteristics: function(callback) {
    var that = this;
    
    wx.getBLEDeviceCharacteristics({
      deviceId: this.deviceId,
      serviceId: this.serviceUUID,
      success: function(res) {
        console.log('[BLE] ===== 特征值列表 =====');
        console.log('[BLE] 特征值数量:', res.characteristics.length);
        
        that._characteristics = res.characteristics;
        
        // 打印所有特征值
        for (var i = 0; i < res.characteristics.length; i++) {
          var c = res.characteristics[i];
          var props = [];
          if (c.properties.read) props.push('读');
          if (c.properties.write) props.push('写');
          if (c.properties.writeNoResponse) props.push('写无响应');
          if (c.properties.notify) props.push('通知');
          if (c.properties.indicate) props.push('指示');
          
          console.log('[BLE] 特征' + i + ':', c.uuid);
          console.log('[BLE]   属性:', props.join(', '));
          
          // 检查 Meshtastic 标准特征值
          var uuidLower = c.uuid.toLowerCase();
          
          // ToRadio
          if (uuidLower.indexOf('f75c76d2') >= 0) {
            that.toRadioChar = c.uuid;
            console.log('[BLE]   >>> 这是 ToRadio (发送)');
          }
          
          // FromRadio
          if (uuidLower.indexOf('2c55e69e') >= 0) {
            that.fromRadioChar = c.uuid;
            console.log('[BLE]   >>> 这是 FromRadio (接收)');
          }
        }
        
        // 备选：根据属性选择
        if (!that.toRadioChar) {
          for (var i = 0; i < res.characteristics.length; i++) {
            var c = res.characteristics[i];
            if (c.properties.write || c.properties.writeNoResponse) {
              that.toRadioChar = c.uuid;
              console.log('[BLE] 备选发送特征值:', c.uuid);
              break;
            }
          }
        }
        
        if (!that.fromRadioChar) {
          for (var i = 0; i < res.characteristics.length; i++) {
            var c = res.characteristics[i];
            if (c.properties.notify || c.properties.indicate) {
              that.fromRadioChar = c.uuid;
              console.log('[BLE] 备选接收特征值:', c.uuid);
              break;
            }
          }
        }
        
        console.log('[BLE] ===== 最终选择 =====');
        console.log('[BLE] 发送 (ToRadio):', that.toRadioChar || '未找到');
        console.log('[BLE] 接收 (FromRadio):', that.fromRadioChar || '未找到');
        
        // 启用通知
        if (that.fromRadioChar) {
          that._enableNotify(callback);
        } else {
          that.connected = true;
          wx.hideLoading();
          callback && callback({ success: true });
        }
      },
      fail: function(err) {
        wx.hideLoading();
        console.error('[BLE] 获取特征值失败:', err);
        callback && callback({ success: false, error: '获取特征值失败' });
      }
    });
  },

  // 启用通知
  _enableNotify: function(callback) {
    var that = this;
    
    console.log('[BLE] 启用通知:', this.fromRadioChar);
    
    wx.notifyBLECharacteristicValueChange({
      deviceId: this.deviceId,
      serviceId: this.serviceUUID,
      characteristicId: this.fromRadioChar,
      state: true,
      success: function() {
        console.log('[BLE] 通知已启用');
        that.connected = true;
        wx.hideLoading();
        callback && callback({ success: true });
      },
      fail: function(err) {
        console.error('[BLE] 启用通知失败:', err);
        that.connected = true;
        wx.hideLoading();
        callback && callback({ success: true });
      }
    });
  },

  // 处理接收到的数据
  _handleData: function(buffer, charId) {
    var bytes = new Uint8Array(buffer);
    
    // 尝试解析为 FromRadio
    var parsed = this._parseFromRadio(bytes);
    console.log('[BLE] 解析结果:', parsed);
    
    if (parsed && parsed.type === 'packet' && parsed.text) {
      // 收到文本消息
      var msg = {
        id: Date.now(),
        type: 'received',
        text: parsed.text,
        time: new Date().toLocaleTimeString(),
        from: parsed.from
      };
      
      // 保存到全局
      getApp().globalData.messages.push(msg);
      
      // 回调
      if (this.onMessage) {
        this.onMessage(msg);
      }
    }
  },

  // 解析 FromRadio 数据
  _parseFromRadio: function(bytes) {
    try {
      var pos = 0;
      var result = { type: 'unknown' };
      
      while (pos < bytes.length) {
        var tag = this._decodeVarint(bytes, pos);
        pos = tag.pos;
        
        var fieldNum = tag.value >> 3;
        var wireType = tag.value & 0x07;
        
        if (fieldNum === 2) {
          // packet (MeshPacket)
          result.type = 'packet';
          var lenData = this._decodeVarint(bytes, pos);
          pos = lenData.pos;
          var packetBytes = bytes.slice(pos, pos + lenData.value);
          pos += lenData.value;
          
          // 解析 MeshPacket
          var packet = this._parseMeshPacket(packetBytes);
          result.text = packet.text;
          result.from = packet.from;
          result.to = packet.to;
        } else if (fieldNum === 3) {
          // my_info
          result.type = 'my_info';
          pos = this._skipField(bytes, pos, wireType);
        } else if (fieldNum === 4) {
          // node_info
          result.type = 'node_info';
          pos = this._skipField(bytes, pos, wireType);
        } else {
          pos = this._skipField(bytes, pos, wireType);
        }
      }
      
      return result;
    } catch (e) {
      console.error('[BLE] 解析错误:', e);
      return { type: 'error' };
    }
  },

  // 解析 MeshPacket
  _parseMeshPacket: function(bytes) {
    var pos = 0;
    var result = { from: 0, to: 0, text: '' };
    
    while (pos < bytes.length) {
      var tag = this._decodeVarint(bytes, pos);
      pos = tag.pos;
      
      var fieldNum = tag.value >> 3;
      var wireType = tag.value & 0x07;
      
      if (fieldNum === 1) {
        // from
        var val = this._decodeVarint(bytes, pos);
        result.from = val.value;
        pos = val.pos;
      } else if (fieldNum === 2) {
        // to (fixed32)
        result.to = bytes[pos] | (bytes[pos+1] << 8) | (bytes[pos+2] << 16) | (bytes[pos+3] << 24);
        pos += 4;
      } else if (fieldNum === 3) {
        // id
        var val = this._decodeVarint(bytes, pos);
        pos = val.pos;
      } else if (fieldNum === 101) {
        // decoded (Data)
        var lenData = this._decodeVarint(bytes, pos);
        pos = lenData.pos;
        var dataBytes = bytes.slice(pos, pos + lenData.value);
        pos += lenData.value;
        
        // 解析 Data
        result.text = this._parseData(dataBytes);
      } else {
        pos = this._skipField(bytes, pos, wireType);
      }
    }
    
    return result;
  },

  // 解析 Data (payload)
  _parseData: function(bytes) {
    var pos = 0;
    var portnum = 0;
    var payload = [];
    
    while (pos < bytes.length) {
      var tag = this._decodeVarint(bytes, pos);
      pos = tag.pos;
      
      var fieldNum = tag.value >> 3;
      var wireType = tag.value & 0x07;
      
      if (fieldNum === 1) {
        // portnum
        var val = this._decodeVarint(bytes, pos);
        portnum = val.value;
        pos = val.pos;
      } else if (fieldNum === 2) {
        // payload
        var lenData = this._decodeVarint(bytes, pos);
        pos = lenData.pos;
        payload = Array.prototype.slice.call(bytes.slice(pos, pos + lenData.value));
        pos += lenData.value;
      } else {
        pos = this._skipField(bytes, pos, wireType);
      }
    }
    
    // 如果是文本消息，解码为字符串
    if (portnum === 1 && payload.length > 0) {
      return this._bytesToString(payload);
    }
    
    return '';
  },

  // 跳过字段
  _skipField: function(bytes, pos, wireType) {
    if (wireType === 0) {
      // varint
      while (pos < bytes.length && (bytes[pos] & 0x80)) pos++;
      pos++;
    } else if (wireType === 1) {
      // 64-bit
      pos += 8;
    } else if (wireType === 2) {
      // length-delimited
      var len = this._decodeVarint(bytes, pos);
      pos = len.pos + len.value;
    } else if (wireType === 5) {
      // 32-bit
      pos += 4;
    }
    return pos;
  },

  // 发送文本消息
  sendText: function(text, callback) {
    console.log('[BLE] ===== 发送消息 =====');
    console.log('[BLE] 文本:', text);
    
    if (!this.connected) {
      console.error('[BLE] 未连接');
      wx.showToast({ title: '请先连接设备', icon: 'none' });
      callback && callback({ success: false, error: '未连接' });
      return;
    }
    
    if (!this.toRadioChar) {
      console.error('[BLE] 无发送通道');
      wx.showToast({ title: '无发送通道', icon: 'none' });
      callback && callback({ success: false, error: '无发送通道' });
      return;
    }
    
    // 构建数据包
    var packet = this._buildToRadioPacket(text);
    var buffer = new Uint8Array(packet).buffer;
    
    console.log('[BLE] 数据包长度:', packet.length);
    console.log('[BLE] 数据包 (hex):', this._buf2hex(buffer));
    
    // 发送
    this._write(buffer, function(success, err) {
      if (success) {
        console.log('[BLE] 发送成功');
        wx.showToast({ title: '已发送', icon: 'success' });
      } else {
        console.error('[BLE] 发送失败:', err);
        wx.showToast({ title: '发送失败', icon: 'none' });
      }
      callback && callback({ success: success, error: err });
    });
  },

  // 写入数据
  _write: function(buffer, callback) {
    var that = this;
    
    // 先尝试 writeNoResponse，失败再试 write
    wx.writeBLECharacteristicValue({
      deviceId: this.deviceId,
      serviceId: this.serviceUUID,
      characteristicId: this.toRadioChar,
      value: buffer,
      writeType: 'writeNoResponse',
      success: function() {
        callback && callback(true);
      },
      fail: function(err) {
        console.log('[BLE] writeNoResponse 失败，尝试 write');
        
        wx.writeBLECharacteristicValue({
          deviceId: that.deviceId,
          serviceId: that.serviceUUID,
          characteristicId: that.toRadioChar,
          value: buffer,
          writeType: 'write',
          success: function() {
            callback && callback(true);
          },
          fail: function(err2) {
            console.error('[BLE] write 也失败:', err2);
            callback && callback(false, err2.errMsg);
          }
        });
      }
    });
  },

  // 构建 ToRadio 数据包
  _buildToRadioPacket: function(text) {
    // UTF-8 编码
    var textBytes = this._stringToBytes(text);
    
    // Data { portnum: 1, payload: text }
    var dataBytes = []
      .concat(this._encodeField(1, 0, 1)) // portnum = 1 (TEXT_MESSAGE_APP)
      .concat(this._encodeField(2, 2, textBytes)); // payload
    
    // MeshPacket
    var packetBytes = []
      .concat(this._encodeField(2, 5, 0xFFFFFFFF)) // to = broadcast (fixed32)
      .concat(this._encodeField(3, 0, this._packetId++)) // id
      .concat(this._encodeField(9, 0, 3)) // hop_limit = 3
      .concat(this._encodeField(101, 2, dataBytes)); // decoded
    
    // ToRadio { packet: MeshPacket }
    var toRadioBytes = this._encodeField(2, 2, packetBytes);
    
    return toRadioBytes;
  },

  // 编码字段
  _encodeField: function(fieldNum, wireType, value) {
    var tag = (fieldNum << 3) | wireType;
    var bytes = this._encodeVarint(tag);
    
    if (wireType === 0) {
      // varint
      bytes = bytes.concat(this._encodeVarint(value));
    } else if (wireType === 2) {
      // length-delimited
      bytes = bytes.concat(this._encodeVarint(value.length));
      bytes = bytes.concat(value);
    } else if (wireType === 5) {
      // fixed32
      bytes = bytes.concat([
        value & 0xFF,
        (value >> 8) & 0xFF,
        (value >> 16) & 0xFF,
        (value >> 24) & 0xFF
      ]);
    }
    
    return bytes;
  },

  // 编码 varint
  _encodeVarint: function(value) {
    var bytes = [];
    value = value >>> 0;
    
    while (value > 0x7F) {
      bytes.push((value & 0x7F) | 0x80);
      value >>>= 7;
    }
    bytes.push(value & 0x7F);
    
    return bytes.length === 0 ? [0] : bytes;
  },

  // 解码 varint
  _decodeVarint: function(bytes, pos) {
    var value = 0;
    var shift = 0;
    
    while (pos < bytes.length) {
      var b = bytes[pos++];
      value |= (b & 0x7F) << shift;
      
      if (!(b & 0x80)) break;
      shift += 7;
    }
    
    return { value: value >>> 0, pos: pos };
  },

  // 字符串转字节数组
  _stringToBytes: function(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) {
        bytes.push(c);
      } else if (c < 0x800) {
        bytes.push(0xC0 | (c >> 6));
        bytes.push(0x80 | (c & 0x3F));
      } else if (c < 0x10000) {
        bytes.push(0xE0 | (c >> 12));
        bytes.push(0x80 | ((c >> 6) & 0x3F));
        bytes.push(0x80 | (c & 0x3F));
      }
    }
    return bytes;
  },

  // 字节数组转字符串
  _bytesToString: function(bytes) {
    var str = '';
    var i = 0;
    
    while (i < bytes.length) {
      var b = bytes[i++];
      
      if (b < 0x80) {
        str += String.fromCharCode(b);
      } else if ((b & 0xE0) === 0xC0) {
        str += String.fromCharCode(((b & 0x1F) << 6) | (bytes[i++] & 0x3F));
      } else if ((b & 0xF0) === 0xE0) {
        str += String.fromCharCode(((b & 0x0F) << 12) | ((bytes[i++] & 0x3F) << 6) | (bytes[i++] & 0x3F));
      }
    }
    
    return str;
  },

  // Buffer 转 Hex
  _buf2hex: function(buffer) {
    var bytes = new Uint8Array(buffer);
    var hex = [];
    
    for (var i = 0; i < Math.min(bytes.length, 50); i++) {
      hex.push(('0' + bytes[i].toString(16)).slice(-2));
    }
    
    if (bytes.length > 50) hex.push('...');
    
    return hex.join(' ');
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

  // 重置
  _reset: function() {
    this.deviceId = null;
    this.serviceUUID = null;
    this.toRadioChar = null;
    this.fromRadioChar = null;
    this.connected = false;
    this.nodeName = null;
    this._packetId = 1;
    this._characteristics = [];
  }
};

module.exports = ble;