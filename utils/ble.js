// Meshtastic BLE 完整实现
// 扫描所有服务，自动检测可用通道

var ble = {
  deviceId: null,
  serviceId: null,
  toRadioChar: null,
  fromRadioChar: null,
  connected: false,
  nodeName: null,
  
  // 回调
  onMessage: null,
  onConnect: null,
  onDisconnect: null,

  init: function() {
    var that = this;
    
    // 监听数据接收
    wx.onBLECharacteristicValueChange(function(res) {
      console.log('[BLE] ★ 收到数据');
      console.log('[BLE] 服务:', res.serviceId);
      console.log('[BLE] 特征值:', res.characteristicId);
      
      var hex = that._ab2hex(res.value);
      console.log('[BLE] 数据:', hex);
      
      if (that.onMessage) {
        that.onMessage({
          serviceId: res.serviceId,
          characteristicId: res.characteristicId,
          data: res.value,
          hex: hex
        });
      }
    });

    // 监听连接状态
    wx.onBLEConnectionStateChange(function(res) {
      console.log('[BLE] 连接状态:', res.connected ? '已连接' : '断开');
      if (!res.connected) {
        that.connected = false;
        if (that.onDisconnect) that.onDisconnect();
      }
    });
    
    console.log('[BLE] 初始化完成');
  },

  // 连接设备
  connect: function(deviceId, callback) {
    var that = this;
    console.log('[BLE] 开始连接:', deviceId);
    wx.showLoading({ title: '连接中...', mask: true });

    wx.createBLEConnection({
      deviceId: deviceId,
      timeout: 20000,
      success: function() {
        console.log('[BLE] ✓ 连接成功');
        that.deviceId = deviceId;
        
        // 延迟后开始发现服务
        setTimeout(function() {
          that._getAllServices(callback);
        }, 2000);
      },
      fail: function(err) {
        wx.hideLoading();
        console.error('[BLE] ✗ 连接失败:', err);
        callback && callback(false, err.errMsg);
      }
    });
  },

  // 获取所有服务并显示
  _getAllServices: function(callback) {
    var that = this;
    
    wx.getBLEDeviceServices({
      deviceId: this.deviceId,
      success: function(res) {
        console.log('[BLE] ====== 服务列表 (' + res.services.length + '个) ======');
        
        var serviceList = [];
        for (var i = 0; i < res.services.length; i++) {
          var s = res.services[i];
          console.log('[BLE] 服务' + i + ': ' + s.uuid + ' (' + (s.isPrimary ? '主服务' : '从服务') + ')');
          serviceList.push(s);
        }
        
        // 遍历每个服务，找可用的
        that._findCharacteristicsInServices(serviceList, 0, callback);
      },
      fail: function(err) {
        wx.hideLoading();
        console.error('[BLE] ✗ 获取服务失败:', err);
        callback && callback(false, '获取服务失败');
      }
    });
  },

  // 逐个服务查找特征值
  _findCharacteristicsInServices: function(services, index, callback) {
    var that = this;
    
    if (index >= services.length) {
      // 全部服务都检查完了
      console.log('[BLE] ====== 检查完成 ======');
      console.log('[BLE] 最终选择:');
      console.log('[BLE]   服务:', that.serviceId);
      console.log('[BLE]   发送:', that.toRadioChar);
      console.log('[BLE]   接收:', that.fromRadioChar);
      
      if (that.toRadioChar || that.fromRadioChar) {
        that.connected = true;
        wx.hideLoading();
        callback && callback(true);
      } else {
        wx.hideLoading();
        callback && callback(false, '未找到可用特征值');
      }
      return;
    }
    
    var service = services[index];
    console.log('[BLE] 检查服务: ' + service.uuid);
    
    wx.getBLEDeviceCharacteristics({
      deviceId: this.deviceId,
      serviceId: service.uuid,
      success: function(res) {
        console.log('[BLE]   特征值数量: ' + res.characteristics.length);
        
        for (var i = 0; i < res.characteristics.length; i++) {
          var c = res.characteristics[i];
          var props = [];
          if (c.properties.read) props.push('R');
          if (c.properties.write) props.push('W');
          if (c.properties.writeNoResponse) props.push('WnR');
          if (c.properties.notify) props.push('N');
          if (c.properties.indicate) props.push('I');
          
          console.log('[BLE]   - ' + c.uuid + ' [' + props.join(',') + ']');
          
          // 优先选择 Meshtastic 标准 UUID
          var uuidUpper = c.uuid.toUpperCase();
          
          // ToRadio - 优先 F75C76D2 或任意可写的
          if (!that.toRadioChar) {
            if (uuidUpper.indexOf('F75C76D2') >= 0 && (c.properties.write || c.properties.writeNoResponse)) {
              that.toRadioChar = c.uuid;
              that.serviceId = service.uuid;
              console.log('[BLE]   >> 选用 ToRadio: ' + c.uuid);
            } else if (!that.toRadioChar && (c.properties.write || c.properties.writeNoResponse)) {
              // 保存第一个可写的作为备选
              that.toRadioChar = c.uuid;
              that.serviceId = service.uuid;
              console.log('[BLE]   >> 备选发送: ' + c.uuid);
            }
          }
          
          // FromRadio - 优先 2C55E69E 或任意可通知的
          if (!that.fromRadioChar) {
            if (uuidUpper.indexOf('2C55E69E') >= 0 && (c.properties.notify || c.properties.indicate)) {
              that.fromRadioChar = c.uuid;
              console.log('[BLE]   >> 选用 FromRadio: ' + c.uuid);
            } else if (!that.fromRadioChar && (c.properties.notify || c.properties.indicate)) {
              // 保存第一个可通知的作为备选
              that.fromRadioChar = c.uuid;
              console.log('[BLE]   >> 备选接收: ' + c.uuid);
            }
          }
        }
        
        // 继续检查下一个服务
        that._findCharacteristicsInServices(services, index + 1, callback);
      },
      fail: function(err) {
        console.error('[BLE]   获取特征值失败:', err);
        // 继续下一个服务
        that._findCharacteristicsInServices(services, index + 1, callback);
      }
    });
  },

  // 发送文本消息
  sendText: function(text, callback) {
    var that = this;
    
    console.log('[BLE] ====== 发送消息 ======');
    console.log('[BLE] 文本:', text);
    console.log('[BLE] 设备ID:', this.deviceId);
    console.log('[BLE] 服务:', this.serviceId);
    console.log('[BLE] 特征值:', this.toRadioChar);
    
    if (!this.connected || !this.toRadioChar) {
      console.error('[BLE] 未连接或无可用发送通道');
      wx.showToast({ title: '请先连接设备', icon: 'none' });
      callback && callback(false, '未连接');
      return;
    }
    
    // 方案1: 直接发送文本
    var textBuffer = new Uint8Array(text.length);
    for (var i = 0; i < text.length; i++) {
      textBuffer[i] = text.charCodeAt(i);
    }
    
    console.log('[BLE] 发送原始文本, 长度:', text.length);
    
    wx.writeBLECharacteristicValue({
      deviceId: this.deviceId,
      serviceId: this.serviceId,
      characteristicId: this.toRadioChar,
      value: textBuffer.buffer,
      success: function() {
        console.log('[BLE] ✓ 发送成功');
        wx.showToast({ title: '已发送', icon: 'success' });
        callback && callback(true);
      },
      fail: function(err) {
        console.error('[BLE] ✗ 发送失败:', err);
        
        // 尝试不带 \\x00 前缀
        that._sendAsProto(text, callback);
      }
    });
  },

  // 方案2: 尝试作为 protobuf 发送
  _sendAsProto: function(text, callback) {
    console.log('[BLE] 尝试 Protobuf 方式...');
    
    // 简单封包: [length(1)][port(1)][text...]
    var packet = [text.length + 1, 1]; // length, port=TEXT_MESSAGE_APP(1)
    for (var i = 0; i < text.length; i++) {
      packet.push(text.charCodeAt(i));
    }
    
    var buffer = new Uint8Array(packet).buffer;
    console.log('[BLE] 发送Protobuf, 长度:', packet.length);
    
    wx.writeBLECharacteristicValue({
      deviceId: this.deviceId,
      serviceId: this.serviceId,
      characteristicId: this.toRadioChar,
      value: buffer,
      success: function() {
        console.log('[BLE] ✓ Protobuf发送成功');
        callback && callback(true);
      },
      fail: function(err) {
        console.error('[BLE] ✗ Protobuf发送也失败:', err);
        wx.showToast({ title: '发送失败', icon: 'none' });
        callback && callback(false, err.errMsg);
      }
    });
  },

  // 启用通知接收
  enableNotify: function(callback) {
    var that = this;
    
    if (!this.fromRadioChar) {
      console.log('[BLE] 无可通知特征值');
      callback && callback();
      return;
    }
    
    console.log('[BLE] 启用通知:', this.fromRadioChar);
    
    wx.notifyBLECharacteristicValueChange({
      deviceId: this.deviceId,
      serviceId: this.serviceId,
      characteristicId: this.fromRadioChar,
      state: true,
      success: function() {
        console.log('[BLE] ✓ 通知已启用');
        callback && callback();
      },
      fail: function(err) {
        console.error('[BLE] ✗ 启用通知失败:', err);
        callback && callback();
      }
    });
  },

  // 断开连接
  disconnect: function(callback) {
    if (this.deviceId) {
      wx.closeBLEConnection({
        deviceId: this.deviceId,
        complete: function() {
          console.log('[BLE] 已断开连接');
          if (callback) callback();
        }
      });
    } else {
      if (callback) callback();
    }
    this._reset();
  },

  _reset: function() {
    this.deviceId = null;
    this.serviceId = null;
    this.toRadioChar = null;
    this.fromRadioChar = null;
    this.connected = false;
  },

  // 工具: ArrayBuffer转Hex
  _ab2hex: function(buffer) {
    var hex = '';
    var view = new Uint8Array(buffer);
    for (var i = 0; i < Math.min(view.length, 64); i++) {
      hex += ('00' + view[i].toString(16)).slice(-2) + ' ';
    }
    if (view.length > 64) hex += '...';
    return hex;
  }
};

module.exports = ble;