# 官方入口背景接入：设计与验证范围

当前方案通过 Windows 的按包激活调试回调，为匹配的官方 MSIX GUI 冷启动补入本地背景连接参数。Windows 11 x64 build 26200、OpenAI.Codex 26.1111.2228.0 已完成两次独立的精确 `OpenAI.Codex_2p2nqsd0c76g0!App` 无参数冷启动：原有商店登录档被保留，挂件、额度与背景连接成功，用户确认画面可见。两次均重新取得背景连接，图片解码与可见样式检查通过。

这份结果只覆盖已测 MSIX 激活入口。直接运行原版 ChatGPT.exe 且不带参数没有触发本轮桥接路径；通知、其他固定项、其他设备和未来包/OS 版本没有自动继承此结论。开始菜单中同名的普通快捷方式与 MSIX AUMID 必须分别识别。

## 组件与流程

1. 既有 companion 监督器读取用户明确保存的开启设置，核对已审查回调、源码、OS build 和当前注册包。
2. broker 在当前交互会话持有按包调试租约，绑定 owner 进程与创建时间。包、文件或 owner 变化会触发撤销；同一应用更新跟随需要用户明确授权。
3. 回调验证包、用户、GUI 与初始进程/线程身份，在仍暂停且满足布局条件时克隆完整参数块并补入回环参数，优先沿用已有 MSIX 登录档。其他入口与子进程不补参数。
4. 独立 watchdog 与回调协调已覆盖的异常、崩溃及超时恢复；背景连接器仍核对实际监听者与目标页面，不能仅凭参数存在报告成功。

不修改官方包，不按 EXE 名全局拦截，不读取登录或聊天内容，不创建替代登录档。当前参数块布局不是跨 Windows 版本的稳定公开约定；OS build 变化后须重新审查，不能仅改记录中的数字。[微软结构边界](https://learn.microsoft.com/en-us/windows/win32/api/winternl/ns-winternl-rtl_user_process_parameters)

## 默认关闭与撤销

公开包携带匹配源码、构建和测试工具，不携带编译回调、本机审查记录、开启设置或租约数据。在目标机完成 18 项自有进程隔离测试并独立审查后，用户明确确认包生命周期影响才启用。记录绑定文件和 OS 条件，不具有设备身份绑定，也不代替用户授权。

`EnableDebugging` 改变包的自动挂起、终止、恢复及激活超时行为；它不是普通快捷方式参数设置。关闭必须由本组件持有的 broker 撤销并核实结果。释放 COM 或调试设置不等于已经恢复所有暂停线程，不能承诺任意系统异常均自动放行。[微软启用说明](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-ipackagedebugsettings-enabledebugging)

完整操作、恢复及当前证据分别见 [OFFICIAL-STARTUP.md](OFFICIAL-STARTUP.md) 与 [VERIFICATION.md](VERIFICATION.md)。安装/更新不代替开启授权，任何实机冷启动验收都等待用户保存工作并正常退出。
