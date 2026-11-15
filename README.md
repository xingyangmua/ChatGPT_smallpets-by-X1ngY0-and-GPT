# gpt自定义插件 · codex_work_pet

版本 **1.1.0-beta.6**。为 Windows x64 上的 Codex / ChatGPT Work 提供可自定义背景、角色挂件和官方订阅额度显示；另有独立的 DSH 背景与角色适配包。

[下载完整 Windows 安装包](https://github.com/xingyangmua/ChatGPT_smallpets-by-X1ngY0-and-GPT/releases/tag/v1.1.0-beta.6) · [安装与维护](docs/AI-INSTALL.md) · [验证范围](docs/VERIFICATION.md) · [DSH 适配说明](adapters/dsh/README.md)

## 本版修复

- 安装记录损坏时保留原件，优先从有效备份恢复，并通过互斥及原子替换减少再次损坏。额度模块异常不再导致整个挂件退出。
- 背景启动优先使用已有的商店版登录档，避免误选另一个普通启动目录；不会新建替代登录档或读取认证文件。
- 增加默认关闭的官方开始菜单启动桥。在 Windows 11 x64 build 26200 上，精确 MSIX 包入口已完成两次独立无参数冷启动：主题参数、挂件与背景连接均通过。启用前须在本机编译、完成隔离测试并单独确认。
- 恢复独立启动动画，动画跟随实际客户端区域，不再强制改变客户端窗口尺寸。保留已有私人视频，公开包不附带视频。
- 可在明确启用后维护当前用户的官方 `ChatGPT.lnk` 主题参数，并保留其图标、目标和其他设置。这只覆盖对应的快捷方式。
- 独立的 `dsh-work-pet` 适配包提供 DSH 页面背景、可拖动角色、开关和本地换图；不读取 DSH 账号配置，不显示 DSH 额度。

## Windows 安装

下载完整 Windows ZIP，解压后运行 `Install.cmd`。GitHub 自动生成的 Source code ZIP 不包含 Electron 运行时，不能当作完整安装包。

已有安装时沿用原目录，保留用户图片、配置与登录资料。默认安装目录是“文档/Codex/codex_work_pet”；历史安装可能使用 `MutsumiCodex` 名称。

安装后从 **ChatGPT (Work Pet)** 启动。运行安装目录中的 `Status.ps1` 和 `Self-Test.ps1`，分别检查挂件显示、额度和背景连接。已有客户端正在工作时先保存任务并正常退出，不强制结束它。

## 启动入口与背景范围

开始菜单可能存在两个同名“ChatGPT”：普通快捷方式 `com.openai.codex` 和 MSIX 包入口 `OpenAI.Codex_2p2nqsd0c76g0!App`。它们的启动方式不同。

| 入口 | 当前范围 |
| --- | --- |
| ChatGPT (Work Pet) | 显式传入主题参数；当前客户端的实际显示仍以验证记录为准 |
| 官方用户级 ChatGPT.lnk | 可选择维护该链接的主题参数；不等于覆盖其他同名入口 |
| 官方 MSIX 包入口 | 启动桥启用后，当前测试系统的两次独立无参数冷启动已连接挂件和背景；见验证范围 |
| 原版 ChatGPT.exe 无参数直接启动 | 当前启动桥不支持本轮测试的这条路径；改用已验证的 MSIX 开始菜单入口或管理入口 |
| 通知及其他固定项 | 尚未验收，不能从开始菜单结果推定 |
| DSH | 使用独立适配包；不依赖本机 Windows 启动桥 |

`backgroundConnected=true` 并且实际图片显示正确，才表示背景完成。`pending-restart` 表示当前窗口尚未接入；后台重连不能给已运行的普通窗口补加启动参数。

安装包包含启动桥源码、构建与测试工具，默认关闭，不附带本机审查记录或预先启用的回调程序。需要从官方 MSIX 开始菜单入口使用背景时，按[本机验证与启用说明](docs/OFFICIAL-STARTUP.md)操作。不要复制他人的审查记录。

## 使用与恢复

角色右键菜单可打开背景和角色设置、关闭挂件；隐藏后可从设置入口或托盘恢复。支持四个角色槽、自选背景、亮度、遮罩、模糊、轮播和原生默认背景。

`Restore-Background.ps1` 关闭背景接入；`Set-Widget.ps1 -State Off` 关闭挂件；`Uninstall.cmd` 停用本组件并保留用户图片与备份。DSH 适配包按其独立说明安装、启用和移除。

默认示例图、音效和第三方代码的许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。真实登录资料、聊天、私人视频及本机实验记录不进入公开包。
