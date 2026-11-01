# gpt自定义插件

项目代码名：`codex_work_pet`。

Windows Codex / ChatGPT Work 桌面端的通用角色挂件与自定义背景组件。角色图片可以替换，默认角色仅是示例素材，不限制其他人物或画风。

**给 AI 安装：** 把本仓库链接交给具备本机终端权限的 GPT / DS / Codex，说“我要应用这个项目”。先阅读 [AGENTS.md](AGENTS.md) 和 [AI 安装流程](docs/AI-INSTALL.md)。纯云端聊天没有电脑访问权限时，不能声称已在本机安装。

## 功能

- 背景选择、自选图、亮度/遮罩/模糊、轮播、浅深色适配；内置“ChatGPT 默认背景”，真正移除主题样式。
- 四个自定义角色槽（默认共用唯一内置图片），透明 PNG、拖拽、贴边、翻转、大小、原按压回弹和音效。
- 点击显示五小时、每周、可用重置次数；低于 10% 独立常驻提醒，可与点击彩蛋同时显示。
- 挂件总开关：关闭后隐藏角色并停止本组件的额度请求，设置入口和轻量跟随监听保留，可重新开启。
- 自定义角色和气泡底图；选择、位置、彩蛋计数及开关记忆。

## 平台与边界

当前公开测试版 `1.1.0-beta.2` 支持 **Windows x64、Microsoft Store 的 OpenAI.Codex 桌面包**。已验证版本 `26.1021.3705.0`，其进程名为 ChatGPT.exe。不是浏览器脚本，也不把经典 ChatGPT 或 DSH 客户端当作同一安装目标。GPT/DS 在这里是执行安装的助手，不能直接套用 DSH 插件安装命令。

原生任务栏/MSIX入口不统一接管背景启动参数；需要本项目的 Codex Work Pet 启动入口。首次安装时客户端已运行且没有受校验的本机调试会话，背景会标记为待接入，不会强制退出客户端或伪装成功。完整冷启动联合验收、其他系统/客户端版本，以及不同模式切换路径均需以实际状态报告为准。

## 安装

普通用户下载 Releases 中的完整 Windows ZIP，解压后双击 `Install.cmd`。GitHub 自动生成的 Source code ZIP 不含 Electron 运行时，不能当作完整离线安装包。

源码仓库的安装器位于 `app/Install.ps1`；完整 Release 解压后的安装器位于根目录 `Install.ps1`。使用完整包时直接运行根目录安装器，不需要再次下载 Release。

AI 可以先执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\app\Install.ps1 -PreflightOnly
```

克隆仓库后，再执行根目录 `Install.ps1 -Repository 用户名/仓库名 -Launch`。仓库根安装器读取 `release.json`，下载固定版本、核对 SHA-256、检查压缩路径后安装。不要使用 `curl | iex`，不要绕过系统安全或授权提示。

安装后桌面和开始菜单有 **Codex Work Pet** 与 **Codex Work Pet Settings**。右键角色包含背景入口①、角色/气泡入口②和挂件总开关；关闭角色后可从设置入口或托盘开启。

默认目录是“文档/Codex/codex_work_pet”。运行 `Status.ps1` 获取真实运行状态；运行 `Self-Test.ps1` 执行隔离逻辑检查。安装包不包含账号、凭据、聊天、用量快照或开发者电脑配置。

## 恢复

`Set-Widget.ps1 -State Off/On` 控制角色；`Restore-Customization.cmd` 恢复示例素材；`Restore-Background.ps1` 移除背景；`Uninstall.cmd` 停用任务并恢复本项目快捷方式，保留用户图片和备份。原客户端、登录、聊天、模型配置和其他插件不删除。

这是从开源项目改编的组件，见 [来源和许可](THIRD_PARTY_NOTICES.md)。代码许可不覆盖角色图片等第三方素材。原电脑的龙娘启动动画没有纳入本公开组件，也不会被覆盖。

## 界面示例

![背景设置](docs/images/background-settings.png)
![右键菜单](docs/images/right-menu.png)

图片来自本组件的隔离界面测试，数字是测试数据。更多说明见 [使用与恢复](docs/USER-GUIDE.md)、[验证范围](docs/VERIFICATION.md) 和 [重建发布包](docs/BUILD.md)。


## 内置素材精简（发布前更新）

背景选项仅保留 ChatGPT 默认背景和蓝天草地（IMG3575.jpg）。内置挂件角色仅保留当前疑问形象（IMG3576.png）；四个可自定义槽默认共用这一张，点击音效、弹性反馈和彩蛋继续生效。其他背景、表情和旧装饰 GIF 不随本版本分发。自选背景、替换角色/气泡的能力保留。


发布前彩蛋文案更新：新增 `kskbl` 和 `zdjd`，保持每 2–5 次有效点击随机触发；气泡只显示彩蛋文字，不添加解释小字。项目宣传名称为「gpt自定义插件」；代码与安装文件继续使用 codex_work_pet。

### 1.1.0-beta.2 更新

额度服务自动跟随商店客户端更新；新增 **ChatGPT (Work Pet)** 搜索入口。已有窗口没有主题连接时，Status.ps1 显示 pending-restart，请安全退出后从此入口冷启动。官方 MSIX 搜索项仍可能绕过主题参数。已有私人动画会保留。

详见 [修复记录](docs/BUGFIX-2026-11-01.md)。
