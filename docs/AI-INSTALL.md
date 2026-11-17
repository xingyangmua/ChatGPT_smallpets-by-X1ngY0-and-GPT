# 安装、维护与验收

本流程适用于 `codex_work_pet 0.1.10` 的 Windows 伴随组件。DSH 使用独立的 `dsh-work-pet` 包，按[适配器说明](https://github.com/xingyangmua/ChatGPT_smallpets-by-X1ngY0-and-GPT/tree/main/adapters/dsh)操作；两种安装方式不能互换。

## 安装前

1. 阅读 README 和当前 AGENTS.md，核对实际注册的 `OpenAI.Codex` 包及 GUI 路径；不要沿用历史 WindowsApps 路径。
2. 从已有组件快捷方式和 `Mutsumi Codex Companion` 任务确认原安装目录，沿用并备份。保留图片、动画素材、设置、登录、聊天和其他插件。
3. 记录实际安装目录的 `Status.ps1` 结果。若客户端正在处理任务，保持运行；需要冷启动时等待用户正常退出。

不要读取、复制或公开 `auth.json`、凭据、账号标识、聊天数据库；不要调用购买或额度重置接口。

主题启动应优先使用已有的商店版登录档，仅在其不存在时回退到已有的普通目录。判断目录和必要文件是否存在即可，不读取登录档内容，不创建替代登录档。

## 选择安装方式

| 文件来源 | 使用方式 |
| --- | --- |
| 完整 Windows Release ZIP | 解压后运行其根目录 `Install.cmd` 或 `Install.ps1` |
| 源码仓库 | 根 `Install.ps1` 按 `release.json` 下载并验证完整包；`app/Install.ps1` 是实际安装器 |
| GitHub Source code ZIP | 只有源码，不能直接当完整安装包 |
| DSH 适配包 | 使用适配器文档中已验证的 DSH 插件安装入口 |

源码预检与更新示例：

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\app\Install.ps1 -PreflightOnly -InstallRoot "现有安装目录"
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\Install.ps1 -Repository xingyangmua/ChatGPT_smallpets-by-X1ngY0-and-GPT -InstallRoot "现有安装目录" -Launch
```

Windows 安装脚本使用 Windows PowerShell 5.1。校验或系统权限失败时报告原因，不绕过保护。若官方启动桥租约仍活动，先使用已安装的 `Disable-OfficialStartup.cmd` 并核实撤销，再更新；安装不会自动代替用户授权开启启动桥。

## 官方开始菜单入口

官方 MSIX 包入口与同名普通快捷方式不同。当前 Windows 11 x64 build 26200 上，启用启动桥后，从 `OpenAI.Codex_2p2nqsd0c76g0!App` 无参数冷启动已经取得一次挂件、额度和背景连接成功记录。原版 EXE 的直接无参数启动不受本轮验证的桥接路径支持；通知和其他固定项另行验收。

默认安装只提供源码及工具。需要启用时，遵循 [OFFICIAL-STARTUP.md](OFFICIAL-STARTUP.md)：在目标机器上以安装后的精确源码构建，完成 14 项功能/故障测试与 4 项身份测试，由独立审查者核对结果和最终文件哈希，再生成本机审查记录。明确说明包生命周期变化并取得用户确认后，才运行开启命令。需要自动跟随同一应用更新时，另取得该范围的授权。

公开包不附带 `StartupBridge.exe`、`reviewed-candidate.json` 或任何租约/策略文件。审查记录不代替授权，也不保证当前客户端已连接；启用后仍需让用户安全退出再从精确 MSIX 入口冷启动验收。

## 验收

- 挂件：`companionRunning`、`widgetVisible`、`widgetSurfaceReady`，再检查实际点击、拖动、设置和开关。
- 额度：`quotaStatus=fresh` 表示官方服务连接；错误或过期数据不能冒充零或有效额度。用户关闭挂件后停止额度请求属于正常行为。
- 背景：要求 `backgroundConnected=true`，并实际检查图片、侧栏、正文和输入框。`pending-restart`、选图已保存或隔离测试通过都不等于实机背景成功。
- 动画：检查真实画面和交接，不只看请求记录；缺少私人媒体时不应阻止正常启动。
- DSH：检查实际插件加载、背景/角色显示、开关、换图和移除；SDK 集成测试不替代真实 DSH 窗口。

每个启动入口单独记录：管理入口、用户级官方 `ChatGPT.lnk`、MSIX AUMID、无参数原版 EXE、通知。普通快捷方式与 MSIX 条目可能同名，不能互相替代验收。

## 维护与交付

运行适用回归与安装自检；已通过且未改变的检查无需重复。源码进入 `app` 时须重建完整包和 `release.json`，同步根目录与包内文档，详见 BUILD.md。

恢复入口为 `Restore-Background.ps1`、`Set-Widget.ps1`、`Restore-PreviousVersion.ps1` 和 `Uninstall.cmd`。卸载或回退应先撤销本组件拥有的入口维护，保留用户资料及第三方插件。

交付时分别报告源码推送、安装包附件、实际安装、挂件、额度、背景及各入口实测；不把其中一项通过说成全部完成。
