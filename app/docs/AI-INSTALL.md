# AI 自主安装流程

1. 从用户提供的 GitHub 链接确认仓库所有者/名称。只读检查 README、AGENTS、根安装器和 app/Install.ps1。没有本机 Windows 执行权限时，说明限制，不能把云端生成文件冒充本机安装。
2. 运行 Windows PowerShell 5.1 的 app/Install.ps1 -PreflightOnly，核对系统、真实桌面包、版本、安装位置和现有副本。经典 ChatGPT、网页、DSH、macOS/Linux不在本版支持范围。
3. 查看 release.json。执行根 Install.ps1 -Repository OWNER/REPO -Launch。仓库 URL 可由已克隆的 git origin 推断；下载源码 ZIP 时请明确传入 OWNER/REPO。校验失败停止，不改用未经校验的镜像。可用 -InstallRoot 指定目录。不要并行安装两个挂件副本。
   如果拿到的已经是含 electron-runtime.zip 的完整 Release 解压目录，直接执行该目录的 Install.ps1 -Launch，不再运行源码仓库的下载器。
4. 安装器备份代码、保留 data；解压完整 Electron 运行时，编译两个 GUI 入口，注册当前用户跟随任务。不会索要或复制账号凭据。登录缺失只能由用户完成官方登录。
5. 运行安装目录 Status.ps1。必须确认 companionRunning=true；客户端可见且挂件开启时应 widgetVisible=true、widgetSurfaceReady=true、quotaStatus=fresh。主动关闭时应 widgetEnabled=false、quotaProcessRunning=false，这不是故障。只有进程存活不足以证明角色已显示。
6. 背景必须 backgroundConnected=true 才能报告完成。现有客户端没有受支持的调试会话时，安装器不强退它。确认没有运行中的任务、且用户或宿主已授权安全重启后，使用 Codex Work Pet 管理入口；否则报告“挂件已安装，背景待接入”。不要把切换成原生背景当作背景失败。
7. 检查桌面设置入口、总开关、右键入口①②、图片切换与保存；用 Self-Test.ps1 的隔离数据验证阈值/未知/断网/重连，不把测试数据注入真实额度。不要消耗重置次数。可从桌面入口或托盘重新开启关闭的挂件。
8. 最终报告实际目录、客户端版本、入口覆盖、实际运行/额度/背景结果和限制，提供卸载恢复命令。不自动上传诊断或截图，不伪称未验证的完整冷启动、其他版本和模式切换已通过。

第一次发布尚未上传对应 Release ZIP 时，安装器下载会失败。需要维护者完成发布；不要静默改用其他项目。
