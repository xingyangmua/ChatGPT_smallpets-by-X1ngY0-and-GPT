# AI 安装、更新与接手流程

本文件与 README.md、AGENTS.md 配合使用。当前组件版本为 `1.1.0-beta.4`。这是一套 Windows 本机伴随组件，不是 DSH 插件注册包。

## 先检查，再执行

1. 确认用户指定的仓库及 `git remote get-url origin`。阅读根与目标目录的 AGENTS.md；本文件不授予额外权限。
2. 检查 Windows x64、Windows PowerShell 5.1，以及 `Get-AppxPackage -Name OpenAI.Codex` 返回的真实安装位置。不要沿用旧版 WindowsApps 目录，不用浏览器或经典 ChatGPT 代替。
3. 从本组件快捷方式与 `Mutsumi Codex Companion` 计划任务找出现有安装目录。存在旧副本就沿用并备份；`MutsumiCodex` 等历史目录名可以保留。不要在默认路径再并行安装第二份。
4. 用实际安装目录的 Status.ps1 记录当前角色、额度、背景和开关状态。检查当前是否有正在运行的任务，保留用户图片、设置、登录、聊天和其他插件。

## 判断手上的文件

| 文件形态 | 预检和安装方法 |
| --- | --- |
| 克隆的源码，含 `app/Install.ps1`、根 `release.json` | 用 `app/Install.ps1 -PreflightOnly` 预检，再用根 `Install.ps1 -Repository OWNER/REPO` 下载经过哈希校验的完整包 |
| 完整 Release，根目录含 `Install.ps1` 与 `electron-runtime.zip` | 直接运行根 `Install.ps1`，无需再次下载 |
| GitHub Source code ZIP | 属于源码，不含完整运行时；不能直接当作离线安装包 |

脚本参数均在 Windows PowerShell 5.1 下执行，示例：

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\app\Install.ps1 -PreflightOnly -InstallRoot "现有安装目录"
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\Install.ps1 -Repository xingyangmua/ChatGPT_smallpets-by-X1ngY0-and-GPT -InstallRoot "现有安装目录" -Launch
```

全新安装可省略 `-InstallRoot`，默认使用“文档/Codex/codex_work_pet”。完整 Release 使用根安装器同样的 `-InstallRoot`、`-Launch` 参数。校验、平台注册或系统权限失败应诊断并报告，不改用未经校验的包或绕过保护。

## 安装或更新后必须完成

- 安装器已备份旧组件代码，并保留 `data`；从 receipt.json 确认安装目录与组件版本。
- 运行 Status.ps1。开启状态且客户端可见时，检查 `companionRunning`、`widgetVisible`、`widgetSurfaceReady` 为 true，`quotaStatus=fresh`。角色主动关闭时，`widgetEnabled=false`、`quotaProcessRunning=false` 是正常状态。
- 运行 Self-Test.ps1；修改源码时运行 `node --test app/widget/tests/*.test.mjs`。已通过且未改变的检查无需反复重跑。
- 实测角色单击、拖拽不误触、音效、右键设置、总开关与重新开启。隔离测试数据只能进入独立测试目录，不得注入真实账号显示。
- 核对真实额度的 300 / 10080 分钟窗口、有效 `usedPercent`、`resetsAt` 和 `rateLimitResetCredits.availableCount`。未知、过期或失败不可显示成零或 100%，也不可消费重置机会。

## 背景的特殊验收

使用 **ChatGPT (Work Pet)** 搜索入口或 **Codex Work Pet** 管理入口。官方 MSIX 搜索项、任务栏旧固定项与通知入口仍可能绕过主题参数。

已有受验证主题会话时可以重连。运行中的普通窗口没有主题连接时，`backgroundStatus=pending-restart` 是待办，不是成功。保留当前任务，等安全退出后从管理入口冷启动；不能强杀客户端、创建替代登录档案或用外部预览页冒充背景。只有 `backgroundConnected=true` 且实际图片和文本检查通过，才能报告真实背景完成。

用户选择关闭或原生默认背景时应尊重其选择，不自动重新打开。后台监听旧 PID 被复用时保留无关进程，不依此阻断本组件的恢复。

## 常见故障

| 现象 | 先检查什么 |
| --- | --- |
| 商店更新后额度不可用 | 当前注册包及 CLI 是否存在；新版每次连接都会重新发现 CLI，可用 Repair-Client.ps1 修复安装记录，再检查挂件健康状态 |
| 额度接口失败 | 只读账号状态、当前网络与退避状态；登录只由用户在官方流程完成，不读取 auth.json 或索要 token |
| 角色不见了 | 总开关、客户端可见性、绘制区域和位置；进程存活不能代替角色可见验收 |
| 搜索打开后没有背景 | 是否打开了官方 MSIX 项；查看 pending-restart 状态并使用管理入口 |
| 下载 404 或校验失败 | Release 标签、完整 ZIP、release.json 和 SHA256SUMS 是否一致，不能静默换版本 |

## 维护和交付

代码修改前检查 git 状态，保留用户未提交内容；按实际缺陷补必要回归，不重写无关功能。版本、锁文件、运行时、安装器与 release.json 必须一致。完整打包和发布见 BUILD.md。

最终分别报告代码/安装、角色显示、真实额度、真实背景、GitHub 推送和 Release 附件的状态。给出实际目录、客户端版本、下载链接和剩余待办；不要把源码已推送等同于安装包已发布。

恢复入口：Set-Widget.ps1、Restore-Background.ps1、Restore-Customization.cmd、Restore-PreviousVersion.ps1 和 Uninstall.cmd。保留用户图片与备份，不删除官方客户端和用户资料。
