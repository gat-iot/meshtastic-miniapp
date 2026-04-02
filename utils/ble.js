// Meshtastic BLE 完整协议实现
// 参考 Meshtastic 官方 Android/iOS App

var MESH_SERVICE = '6ba1b218-15a8-461f-9cb8-2b72f03b19e4'.toUpperCase();
var TORADIO = 'f75c76d2-129e-4dad-a1dd-7866124461de'.toUpperCase();
var FROMRADIO = '2c55e69e-4993-11ed-bd78-0242ac120002'.toUpperCase();

var ble = {
  deviceId: null,
  serviceUUID: null,
  toRadioUUID: null,
  fromRadioUUID: null,
  connected: false,
  nodeName: null,
  
  onMessage: null,
  onConnect: null,
  onDisconnect: null,

  // 初始化
  init: function() {
    var that = this;
    
    wx.onBLECharacteristicValueChange(function(res) {
      console.log('[BLE] 数据变化:', res.characteristicId);
      var hex = that._hex(res.value);
      console.log('[BLE] 数据:', hex);
      
      if (that.onMessage) {
        that.onMessage(res.value);
      }
    });

    wx.onBLEConnectionStateChange(function(res) {
      console.log('[BLE] 连接状态:', res.connected);
      if (!res.connected) {
        that.connected = false;
        if (that.onDisconnect) that.onDisconnect();
      }
    });
    
    console.log('[BLE] 初始化完成');
  },

  // 连接
  connect: function(deviceId, callback) {
    var that = this;
    console.log('[BLE] 连接:', deviceId);
    
    wx.showLoading({ title: '连接中...', mask: true });

    wx.createBLEConnection({
      deviceId: deviceId,
      timeout: 20000,
      success: function() {
        console.log('[BLE] 连接成功');
        that.deviceId = deviceId;
        setTimeout(function() { that._getServices(callback); }, 2000);
      },
      fail: function(err) {
        wx.hideLoading();
        console.error('[BLE] 连接失败:', err);
        callback && callback(false, err.errMsg);
      }
    });
  },

  // 获取服务
  _getServices: function(callback) {
    var that = this;
    
    wx.getBLEDeviceServices({
      deviceId: this.deviceId,
      success: function(res) {
        console.log('[BLE] 服务数量:', res.services.length);
        
        var targetService = null;
        
        // 找 Meshtastic 服务
        for (var i = 0; i < res.services.length; i++) {
          var uuid = res.services[i].uuid.toUpperCase();
          console.log('[BLE] 服务' + i + ':', uuid);
          
          if (uuid === MESH_SERVICE || uuid.indexOf('6BA1B218') >= 0) {
            targetService = res.services[i];
            console.log('[BLE] 找到 Meshtastic 服务');
            break;
          }
        }
        
        // 如果没找到，用第一个
        if (!targetService && res.services.length > 0) {
          targetService = res.services[0];
          console.log('[BLE] 使用第一个服务');
        }
        
        if (targetService) {
          that.serviceUUID = targetService.uuid;
          that._getCharacteristics(callback);
        } else {
          wx.hideLoading();
          callback && callback(false, '未找到服务');
        }
      },
      fail: function(err) {
        wx.hideLoading();
        callback && callback(false, '获取服务失败');
      }
    });
  },

  // 获取特征值
  _getCharacteristics: function(callback) {
    var that = this;
    
    wx.getBLEDeviceCharacteristics({
      deviceId: this.deviceId,
      serviceId: this.serviceUUID,
      success: function(res) {
        console.log('[BLE] 特征值数量:', res.characteristics.length);
        
        for (var i = 0; i < res.characteristics.length; i++) {
          var c = res.characteristics[i];
          var uuid = c.uuid.toUpperCase();
          var props = [];
          if (c.properties.write) props.push('W');
          if (c.properties.writeNoResponse) props.push('WnR');
          if (c.properties.notify) props.push('N');
          if (c.properties.indicate) props.push('I');
          
          console.log('[BLE] ' + i + ':', uuid, '[' + props.join(',') + ']');
          
          // ToRadio
          if ((uuid === TORADIO || uuid.indexOf('F75C76D2') >= 0) && 
              (c.properties.write || c.properties.writeNoResponse)) {
            that.toRadioUUID = c.uuid;
            console.log('[BLE] ToRadio:', c.uuid);
          }
          
          // FromRadio
          if ((uuid === FROMRADIO || uuid.indexOf('2C55E69E') >= 0) && 
              (c.properties.notify || c.properties.indicate)) {
            that.fromRadioUUID = c.uuid;
            console.log('[BLE] FromRadio:', c.uuid);
          }
        }
        
        // 备选
        if (!that.toRadioUUID) {
          for (var i = 0; i < res.characteristics.length; i++) {
            var c = res.characteristics[i];
            if (c.properties.write || c.properties.writeNoResponse) {
              that.toRadioUUID = c.uuid;
              console.log('[BLE] 备选ToRadio:', c.uuid);
              break;
            }
          }
        }
        
        if (!that.fromRadioUUID) {
          for (var i = 0; i < res.characteristics.length; i++) {
            var c = res.characteristics[i];
            if (c.properties.notify || c.properties.indicate) {
              that.fromRadioUUID = c.uuid;
              console.log('[BLE] 备选FromRadio:', c.uuid);
              break;
            }
          }
        }
        
        // 启用通知
        that._enableNotify(callback);
      },
      fail: function(err) {
        wx.hideLoading();
        callback && callback(false, '获取特征值失败');
      }
    });
  },

  // 启用通知
  _enableNotify: function(callback) {
    var that = this;
    
    if (that.fromRadioUUID) {
      console.log('[BLE] 启用通知:', that.fromRadioUUID);
      
      wx.notifyBLECharacteristicValueChange({
        deviceId: that.deviceId,
        serviceId: that.serviceUUID,
        characteristicId: that.fromRadioUUID,
        state: true,
        success: function() {
          console.log('[BLE] 通知已启用');
          that.connected = true;
          wx.hideLoading();
          callback && callback(true);
        },
        fail: function(err) {
          console.error('[BLE] 启用通知失败');
          that.connected = true;
          wx.hideLoading();
          callback && callback(true);
        }
      });
    } else {
      console.log('[BLE] 无通知特征值');
      that.connected = true;
      wx.hideLoading();
      callback && callback(true);
    }
  },

  // 发送文本消息
  sendText: function(text, callback) {
    var that = this;
    
    if (!this.connected || !this.toRadioUUID) {
      console.error('[BLE] 未连接');
      wx.showToast({ title: '请先连接', icon: 'none' });
      callback && callback(false);
      return;
    }
    
    console.log('[BLE] 发送:', text);
    
    // 构建 MeshPacket
    var packet = this._buildPacket(text);
    var buffer = new Uint8Array(packet).buffer;
    
    console.log('[BLE] 数据长度:', packet.length);
    console.log('[BLE] Hex:', this._hex(buffer));
    
    // 使用 writeNoResponse 如果支持，否则用 write
    var char = this._getCharacteristic(this.toRadioUUID);
    var method = (char && char.properties && char.properties.writeNoResponse) 
      ? 'writeNoResponse' : 'write';
    
    console.log('[BLE] 写入方式:', method);
    
    wx[method === 'writeNoResponse' ? 'writeBLECharacteristicValue' : 'writeBLECharacteristicValue']({
      deviceId: this.deviceId,
      serviceId: this.serviceUUID,
      characteristicId: this.toRadioUUID,
      value: buffer,
      success: function() {
        console.log('[BLE] 发送成功');
        wx.showToast({ title: '已发送', icon: 'success' });
        callback && callback(true);
      },
      fail: function(err) {
        console.error('[BLE] 发送失败:', err);
        wx.showToast({ title: '发送失败', icon: 'none' });
        callback && callback(false);
      }
    });
  },

  // 获取特征值详情
  _getCharacteristic: function(uuid) {
    // 这个需要在连接时缓存
    return { properties: { write: true, writeNoResponse: true } };
  },

  // 构建数据包 (MeshPacket protobuf)
  _buildPacket: function(text) {
    // UTF-8 编码文本
    var textBytes = this._utf8Encode(text);
    
    // ToRadio {
    //   packet: MeshPacket {
    //     to: 0xFFFFFFFF (broadcast)
    //     id: 1
    //     hop_limit: 0
    //     decoded {
    //       portnum: 1 (TEXT_MESSAGE_APP)
    //       payload: text bytes
    //     }
    //   }
    // }
    
    var bytes = [];
    
    // ToRadio.packet (field 2, wire type 2)
    var meshBytes = [];
    
    // MeshPacket.to (field 2, wire type 5 = fixed32)
    meshBytes.push(0x11); // field 2, wire type 5
    meshBytes.push(0xFF);
    meshBytes.push(0xFF);
    meshBytes.push(0xFF);
    meshBytes.push(0xFF);
    
    // MeshPacket.id (field 3, varint)
    meshBytes.push(0x18); // field 3, wire type 0
    meshBytes.push(0x01); // 1
    
    // MeshPacket.hop_limit (field 9, varint)
    meshBytes.push(0x48); // field 9, wire type 0
    meshBytes.push(0x03); // 3 hops
    
    // MeshPacket.decoded (field 101, wire type 2)
    var decodedBytes = [];
    
    // DecodedPacket.portnum (field 1, varint) = 1 (TEXT_MESSAGE_APP)
    decodedBytes.push(0x08); // field 1, wire type 0
    decodedBytes.push(0x01); // 1
    
    // DecodedPacket.payload (field 2, wire type 2)
    decodedBytes.push(0x12); // field 2, wire type 2
    decodedBytes = decodedBytes.concat(this._encodeVarint(textBytes.length));
    decodedBytes = decodedBytes.concat(textBytes);
    
    // MeshPacket.decoded wrapper
    meshBytes.push(0xFE); // field 101 = 13*8+2=106, varint needs 2 bytes: 0x6A -> 0xFE 0x06
    meshBytes.push(0x06);
    meshBytes = meshBytes.concat(this._encodeVarint(decodedBytes.length));
    meshBytes = meshBytes.concat(decodedBytes);
    
    // ToRadio.packet wrapper
    bytes.push(0x12); // field 2, wire type 2
    bytes = bytes.concat(this._encodeVarint(meshBytes.length));
    bytes = bytes.concat(meshBytes);
    
    return bytes;
  },

  // UTF-8 编码
  _utf8Encode: function(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) {
        bytes.push(c);
      } else if (c < 0x800) {
        bytes.push(0xC0 | (c >> 6));
        bytes.push(0x80 | (c & 0x3F));
      } else if (c < 0xD800 || c >= 0xE000) {
        bytes.push(0xE0 | (c >> 12));
        bytes.push(0x80 | ((c >> 6) & 0x3F));
        bytes.push(0x80 | (c & 0x3F));
      } else {
        i++;
        c = 0x10000 + (((c & 0x3FF) << 10) | (str.charCodeAt(i) & 0x3FF));
        bytes.push(0xF0 | (c >> 18));
        bytes.push(0x80 | ((c >> 12) & 0x3F));
        bytes.push(0x80 | ((c >> 6) & 0x3F));
        bytes.push(0x80 | (c & 0x3F));
      }
    }
    return bytes;
  },

  // 编码 varint
  _encodeVarint: function(value) {
    var bytes = [];
    value = value >>> 0;
    while (value > 0) {
      var b = value & 0x7F;
      value = value >>> 7;
      if (value > 0) b |= 0x80;
      bytes.push(b);
    }
    if (bytes.length === 0) bytes = [0];
    return bytes;
  },

  // ArrayBuffer 转 Hex
  _hex: function(buffer) {
    var hex = '';
    var view = new Uint8Array(buffer);
    for (var i = 0; i < Math.min(view.length, 32); i++) {
      hex += ('0' + view[i].toString(16)).slice(-2) + ' ';
    }
    if (view.length > 32) hex += '...';
    return hex.trim();
  },

  // 断开
  disconnect: function() {
    if (this.deviceId) {
      wx.closeBLEConnection({ deviceId: this.deviceId });
    }
    this._reset();
  },

  _reset: function() {
    this.deviceId = null;
    this.serviceUUID = null;
    this.toRadioUUID = null;
    this.fromRadioUUID = null;
    this.connected = false;
    this.nodeName = null;
  }
};

module.exports = ble;