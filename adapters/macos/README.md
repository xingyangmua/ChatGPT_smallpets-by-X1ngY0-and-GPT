# Work Pet for Mac

角色跟随前台的官方 ChatGPT 窗口，初始位置在窗口右下方。平时只显示角色。单击切换表情，弹出的卡片显示订阅剩余额度或角色彩蛋，约五秒后收起。拖动可以调整位置，右键可以为四个角色槽更换图片、恢复位置或隐藏角色。切换到其他应用或最小化聊天窗口时，角色随之隐藏。

## 安装和使用

解压 macOS 安装包，运行根目录的 `Install-macOS.command`，然后照常从 Dock 或「应用程序」打开官方 ChatGPT。安装器通过官方插件目录注册 Work Pet，在当前用户的登录会话中启动负责显示角色的后台服务。组件使用系统 AppKit 和 ChatGPT 随附的运行时。

隐藏后可以在官方插件入口调用 Work Pet 并说「显示我的挂件」。也可以运行以下命令检查、恢复位置或卸载。卸载会保留个人角色图片和偏好。

```sh
manager="$HOME/Library/Application Support/Codex Work Pet/manage.sh"
/bin/bash "$manager" status
/bin/bash "$manager" show
/bin/bash "$manager" reset-position
/bin/bash "$manager" uninstall
```

## 验证

在 macOS 27.0、Apple Silicon、ChatGPT 26.1111.71704 上测试。以下命令可从源码包根目录运行。角色自检使用临时目录保存测试状态。

```sh
test_state="$(mktemp -d)"
WORK_PET_STATE="$test_state" WORK_PET_ASSETS="$PWD/app/widget/assets" \
  /usr/bin/osascript -l JavaScript adapters/macos/pet.js --self-test
/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node --test adapters/macos/tests/*.test.mjs
```

额度来自本机官方客户端的只读接口。额度失效或过期时，挂件收起相应数值。运行状态可通过 `status` 查看，其中 `visible` 表示 macOS 窗口系统能找到正在显示的角色面板。
