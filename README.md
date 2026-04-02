# Meshtastic 微信小程序

Meshtastic 设备的微信小程序客户端，通过蓝牙连接 Meshtastic 设备实现离网通信。

## 功能特性

- 📱 **蓝牙连接** - 扫描并连接 Meshtastic 设备
- 💬 **消息收发** - 通过 LoRa 网络发送和接收消息
- 📻 **频道管理** - 配置和管理通信频道
- 📡 **设备管理** - 查看设备状态和邻居节点

## 开发环境

- 微信开发者工具
- Node.js (用于 npm 依赖)

## 安装依赖

```bash
npm install
```

然后在微信开发者工具中：工具 → 构建 npm

## 项目结构

```
meshtastic-miniapp/
├── miniprogram/
│   ├── app.js              # 应用入口
│   ├── app.json            # 应用配置
│   ├── app.wxss            # 全局样式
│   ├── pages/
│   │   ├── index/          # 首页/连接页
│   │   ├── messages/       # 消息页
│   │   ├── devices/        # 设备列表页
│   │   ├── channels/       # 频道配置页
│   │   └── settings/       # 设置页
│   ├── utils/
│   │   └── ble.js          # BLE 通信模块
│   └── assets/
│       └── icons/          # 图标资源
├── project.config.json     # 项目配置
└── package.json            # npm 配置
```

## 技术栈

- 微信小程序原生开发
- BLE (低功耗蓝牙)
- Protobuf (消息协议)

## 注意事项

1. **Protobuf 集成**：需要使用 protobufjs 编译 Meshtastic 协议定义
2. **蓝牙权限**：需要在 `app.json` 中配置蓝牙权限
3. **MTU 协商**：建议协商 MTU 为 512 以提高传输效率

## 待完善功能

- [ ] 完整的 Protobuf 消息编解码
- [ ] 设备配置同步
- [ ] 频道二维码分享
- [ ] 离线地图集成
- [ ] 位置共享

## 相关资源

- [Meshtastic 官网](https://meshtastic.org)
- [Meshtastic 协议定义](https://github.com/meshtastic/protobufs)
- [微信小程序 BLE 文档](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.openBluetoothAdapter.html)

## 许可证

GPL-3.0
