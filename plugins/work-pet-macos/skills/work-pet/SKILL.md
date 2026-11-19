---
name: work-pet
description: 在 macOS 上显示、隐藏或检查 X1ngY0 的 Work Pet 角色挂件，以及说明如何使用挂件设置和查看额度。适用于已安装的 Work Pet for Mac 伴随组件。
---

# Work Pet for Mac

在当前 Mac 上通过已安装的管理脚本执行用户指定的操作。只询问运行情况时，执行第一条命令。显示或隐藏挂件时，分别执行对应命令。

```sh
/bin/bash "$HOME/Library/Application Support/Codex Work Pet/manage.sh" status
```

```sh
/bin/bash "$HOME/Library/Application Support/Codex Work Pet/manage.sh" show
```

```sh
/bin/bash "$HOME/Library/Application Support/Codex Work Pet/manage.sh" hide
```

根据命令的退出状态及输出反馈结果。查询状态时，区分组件是否运行、官方窗口是否在前台，以及角色是否实际可见。若找不到管理脚本，说明还需要安装此项目的 macOS 伴随组件，并提供[项目发布页](https://github.com/xingyangmua/ChatGPT_smallpets-by-X1ngY0-and-GPT/releases)。正常打开官方 ChatGPT 应用即可使用已安装的挂件。

右键点击挂件可选择四个角色槽、更换角色图片或恢复位置。单击角色时会暂时弹出额度卡或角色彩蛋。只有从官方服务取得有效额度时才会显示百分比。
