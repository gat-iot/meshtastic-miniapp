// Meshtastic BLE 通信模块
// 基于 Meshtastic 协议实现 BLE 连接和消息收发

// Meshtastic BLE UUID
const MESH_SERVICE_UUID = '6BA1B218-15A8-461F-9CB8-2B72F03B19E4';
const TORADIO_UUID = 'F75C76D2-129E-4DAD-A1DD-7866124461DE';
const FROMRADIO_UUID = '2C55E69E-4993-11ED-BD78-0242AC120002';
const LOGRADIO_UUID = 'B5829006-4993-11ED-BD78-0242AC120002';

// 端口号
const PortNum = {
  UNKNOWN_APP: 0,
  TEXT_MESSAGE_APP: 1,
  REMOTE_HARDWARE_APP: 2,
  POSITION_APP: 3,
  NODEINFO_APP: 4,
  ROUTING_APP: 5,
  ADMIN_APP: 6,
  TEXT_MESSAGE_COMPRESSED_APP: 7,
  WAYPOINT_APP: 8,
  AUDIO_APP: 9,
  DETECTOR_SENSOR_APP: 10,
  REPLY_APP: 11,
  IP_TUNNEL_APP: 12,
  PAXCOUNTER_APP: 13,
  SERIAL_APP: 64,
  STORE_FORWARD_APP: 65,
  RANGE_TEST_APP: 66,
  TELEMETRY_APP: 67,
  ZPS_APP: 68,
  SIMULATOR_APP: 69,
  TRACKER_APP: 70,
  ATAK_FORWARDER: 71,
  MAP_REPORT_APP: 72,
  POWERSTRESS_APP: 73
};

var ble = {
  // 连接状态
  deviceId: null,
  serviceId: null,
  toRadioId: null,
  fromRadioId: null,
  isConnected: false,
  
  // 消息回调
  onMessage: null,
  
  // 连接设备
  connect: function(deviceId, callback) {
    var that = this;
    
    wx.showLoading({ title: '连接中...' });
    
    wx.createBLEConnection({
      deviceId: deviceId,
      timeout: 20000,
      success: function() {
        console.log('BLE 连接成功');
        that.deviceId = deviceId;
        
        // 设置 MTU
        wx.setBLEMTU({
          deviceId: deviceId,
          mtu: 512,
          success: function(res) {
            console.log('MTU 设置成功:', res.mtu);
          }
        });
        
        // 发现服务
        setTimeout(function() {
          that.discoverServices(callback);
        }, 1000);
      },
      fail: function(err) {
        wx.hideLoading();
        console.error('连接失败:', err);
        callback && callback({ success: false, error: err.errMsg });
      }
    });
  },
  
  // 发现服务
  discoverServices: function(callback) {
    var that = this;
    
    wx.getBLEDeviceServices({
      deviceId: this.deviceId,
      success: function(res) {
        console.log('服务列表:', res.services);
        
        // 查找 Meshtastic 服务
        var meshService = null;
        for (var i = 0; i < res.services.length; i++) {
          var uuid = res.services[i].uuid.toUpperCase();
          if (uuid.indexOf('6BA1B218') >= 0 || uuid.indexOf('6ba1b218') >= 0) {
            meshService = res.services[i];
            break;
          }
        }
        
        if (!meshService) {
          // 如果找不到 Meshtastic 服务，使用第一个服务
          console.log('未找到 Meshtastic 服务，使用第一个服务');
          meshService = res.services[0];
        }
        
        console.log('使用服务:', meshService.uuid);
        that.serviceId = meshService.uuid;
        
        // 发现特征值
        that.discoverCharacteristics(callback);
      },
      fail: function(err) {
        wx.hideLoading();
        console.error('发现服务失败:', err);
        callback && callback({ success: false, error: '发现服务失败' });
      }
    });
  },
  
  // 发现特征值
  discoverCharacteristics: function(callback) {
    var that = this;
    
    wx.getBLEDeviceCharacteristics({
      deviceId: this.deviceId,
      serviceId: this.serviceId,
      success: function(res) {
        console.log('特征值列表:', res.characteristics);
        
        // 查找 ToRadio 和 FromRadio
        for (var i = 0; i < res.characteristics.length; i++) {
          var char = res.characteristics[i];
          var uuid = char.uuid.toUpperCase();
          
          console.log('特征值:', uuid, 'properties:', char.properties);
          
          // ToRadio - 用于发送
          if (uuid.indexOf('F75C76D2') >= 0) {
            that.toRadioId = char.uuid;
            console.log('找到 ToRadio:', char.uuid);
          }
          
          // FromRadio - 用于接收
          if (uuid.indexOf('2C55E69E') >= 0) {
            that.fromRadioId = char.uuid;
            console.log('找到 FromRadio:', char.uuid);
          }
        }
        
        // 如果没找到，使用第一个可写的特征值
        if (!that.toRadioId && res.characteristics.length > 0) {
          for (var j = 0; j < res.characteristics.length; j++) {
            var c = res.characteristics[j];
            if (c.properties.write || c.properties.writeNoResponse) {
              that.toRadioId = c.uuid;
              console.log('使用备用 ToRadio:', c.uuid);
              break;
            }
          }
        }
        
        if (!that.fromRadioId && res.characteristics.length > 0) {
          for (var k = 0; k < res.characteristics.length; k++) {
            var c = res.characteristics[k];
            if (c.properties.notify || c.properties.indicate) {
              that.fromRadioId = c.uuid;
              console.log('使用备用 FromRadio:', c.uuid);
              break;
            }
          }
        }
        
        // 启用通知
        that.enableNotify(callback);
      },
      fail: function(err) {
        wx.hideLoading();
        console.error('发现特征值失败:', err);
        callback && callback({ success: false, error: '发现特征值失败' });
      }
    });
  },
  
  // 启用通知
  enableNotify: function(callback) {
    var that = this;
    
    if (!this.fromRadioId) {
      wx.hideLoading();
      console.log('没有可通知的特征值');
      that.isConnected = true;
      callback && callback({ success: true });
      return;
    }
    
    wx.notifyBLECharacteristicValueChange({
      deviceId: this.deviceId,
      serviceId: this.serviceId,
      characteristicId: this.fromRadioId,
      state: true,
      success: function() {
        console.log('启用通知成功');
        that.isConnected = true;
        wx.hideLoading();
        callback && callback({ success: true });
      },
      fail: function(err) {
        console.error('启用通知失败:', err);
        that.isConnected = true;
        wx.hideLoading();
        callback && callback({ success: true });
      }
    });
  },
  
  // 监听数据
  startListen: function() {
    var that = this;
    
    wx.onBLECharacteristicValueChange(function(res) {
      console.log('收到数据:', res);
      
      // 解析数据
      var data = that.ab2hex(res.value);
      console.log('数据(hex):', data);
      
      // 回调
      if (that.onMessage) {
        that.onMessage({
          data: data,
          raw: res.value
        });
      }
    });
  },
  
  // 发送文本消息
  sendText: function(text, callback) {
    if (!this.isConnected || !this.toRadioId) {
      callback && callback({ success: false, error: '未连接' });
      return;
    }
    
    var that = this;
    
    // 构建 MeshPacket
    var packet = this.buildTextMessage(text);
    
    console.log('发送数据:', this.ab2hex(packet.buffer));
    
    wx.writeBLECharacteristicValue({
      deviceId: this.deviceId,
      serviceId: this.serviceId,
      characteristicId: this.toRadioId,
      value: packet.buffer,
      success: function() {
        console.log('发送成功');
        callback && callback({ success: true });
      },
      fail: function(err) {
        console.error('发送失败:', err);
        callback && callback({ success: false, error: err.errMsg });
      }
    });
  },
  
  // 构建文本消息包
  buildTextMessage: function(text) {
    // 简化版：直接发送文本
    // 实际应该使用 Protobuf 编码
    
    var encoder = new TextEncoder();
    var textBytes = encoder.encode(text);
    
    // 构建简单的数据包
    // 格式: [length][port][data]
    var length = 1 + textBytes.length; // port + text
    var buffer = new ArrayBuffer(2 + length);
    var view = new Uint8Array(buffer);
    
    view[0] = length & 0xFF;
    view[1] = (length >> 8) & 0xFF;
    view[2] = PortNum.TEXT_MESSAGE_APP; // port
    
    for (var i = 0; i < textBytes.length; i++) {
      view[3 + i] = textBytes[i];
    }
    
    return view;
  },
  
  // 断开连接
  disconnect: function() {
    if (this.deviceId) {
      wx.closeBLEConnection({
        deviceId: this.deviceId,
        complete: function() {
          console.log('已断开');
        }
      });
    }
    
    this.deviceId = null;
    this.serviceId = null;
    this.toRadioId = null;
    this.fromRadioId = null;
    this.isConnected = false;
  },
  
  // ArrayBuffer 转 Hex
  ab2hex: function(buffer) {
    var hexArr = Array.prototype.map.call(
      new Uint8Array(buffer),
      function(x) {
        return ('00' + x.toString(16)).slice(-2);
      }
    );
    return hexArr.join(' ');
  }
};

module.exports = ble;