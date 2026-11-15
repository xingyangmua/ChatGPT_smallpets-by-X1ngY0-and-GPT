# 官方 MSIX 开始菜单启动桥

本目录包含默认关闭的实验启动桥及其构建、隔离测试、租约和停止工具。Windows 11 x64 build 26200、`OpenAI.Codex 26.1111.2228.0` 上，精确 MSIX 开始菜单入口的两次独立真实无参数冷启动已连接挂件、额度和背景。原版 EXE 直接无参数启动不受本轮验证的路径支持，其他入口与未来版本不可据此推定。

完整的本机验证、独立审查、用户确认、启用及关闭步骤见 [官方启动桥说明](../docs/OFFICIAL-STARTUP.md)，实际验证范围见 [VERIFICATION.md](../docs/VERIFICATION.md)。

公开分发只包含源码和工具，不包含 `StartupBridge.exe`、`reviewed-candidate.json`、启用设置或租约数据。必须在目标机用精确源码完成 14 项功能/故障检查和 4 项身份检查，独立审查最终文件哈希，再取得用户授权。审查记录不代替授权；当前记录绑定文件/OS build/架构，不具备设备身份绑定。

- `Build.ps1` 默认构建不执行真实参数重建；`-ExperimentalPatch` 显式生成实验候选；`-SelfTest` 仅供自有测试进程。
- `Test.ps1` 与 `Identity-Test.ps1` 验证自己的进程，不启用真实包。
- `Lease.ps1` 默认只读预检；真正启用必须通过匹配的审查记录及显式确认。
- `Stop.ps1` 验证并通知本组件拥有的 broker 撤销；收到 `released` 和 `DisableDebugging-succeeded` 才能确认调试设置释放。

不要复制开发机审查记录，不要在没有本机验证和用户确认的情况下设置开启参数。更新或替换文件前先按已安装的关闭工具核实原租约释放，不强制终止官方客户端。
