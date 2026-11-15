# 官方开始菜单启动桥：本机验证与启用

这是默认关闭的实验功能。Windows 11 x64 build **26200**、`OpenAI.Codex 26.1111.2228.0` 上，精确 MSIX 入口 `OpenAI.Codex_2p2nqsd0c76g0!App` 已完成两次独立无参数冷启动，挂件可见、额度 fresh、背景连接成功，用户确认实际画面正常。两轮均取得背景连接和图片解码结果，详细范围见 [VERIFICATION.md](VERIFICATION.md)。当前测试中的原版 `ChatGPT.exe` 直接无参数启动不受此路径支持；通知和其他固定项没有由此获得兼容保证。

公开包提供源码和工具，不附带 `StartupBridge.exe`、`reviewed-candidate.json` 或任何机器的启用设置。普通安装不会自动启用。若不需要此功能，继续使用 `ChatGPT (Work Pet)` 管理入口即可。

## 作用与已知边界

组件通过 Windows 包调试接口，在匹配的 MSIX 激活回调中为初始暂停的 GUI 进程补入背景连接参数。它核对当前用户、精确包/GUI、进程和线程身份；只对符合条件的初始进程修改参数。它不修改官方包，不读取登录或聊天内容，不接管所有同名 EXE。

它优先沿用已有的商店版登录档，只有前者不存在时才回退到已有普通目录；只检查必要文件存在，不读取其内容，不建立新的登录档。背景端口限定为 `127.0.0.1:9335..9345`，实际连接继续核对监听者身份。

启用 Windows `EnableDebugging` 会改变该包的自动挂起、终止、恢复和激活超时行为。独立 watchdog 处理已验证的回调崩溃/超时；撤销调试设置本身并不证明所有已暂停线程已经恢复。不能承诺任意系统故障下均自动恢复。接口没有读取既有调试配置的能力，开启前须确认没有其他调试器正在管理该包。[微软接口说明](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-ipackagedebugsettings-enabledebugging)

当前参数块布局仅在上述 OS build 上取得证据。微软说明相关内部结构未来可能改变；其他 Windows build 不能仅修改审查记录中的版本号后启用。[参数结构说明](https://learn.microsoft.com/en-us/windows/win32/api/winternl/ns-winternl-rtl_user_process_parameters)

## 在目标机器上准备

先完成普通组件安装。若已有启动桥活动，用已安装的 `Disable-OfficialStartup.cmd` 关闭，并确认原租约 `released` 且 `DisableDebugging-succeeded`，再替换或编译候选。不要终止官方客户端。

以下在 Windows PowerShell 5.1 中执行；`$install` 填实际安装目录，不能复制他人的安装路径。所有检查使用该安装目录的精确源码，测试只创建并恢复自己的测试进程，不启用真实包。

```powershell
$install = '现有组件安装目录'
$bridge = Join-Path $install 'official-startup'
$testRoot = Join-Path $env:TEMP ('WorkPet-StartupReview-' + [Guid]::NewGuid().ToString('N'))

powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "$bridge\Test.ps1" -WorkDirectory "$testRoot\functional"
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "$bridge\Identity-Test.ps1" -TestExecutable "$testRoot\functional\StartupBridge.Test.exe" -WorkDirectory "$testRoot\identity"
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "$bridge\Build.ps1" -ExperimentalPatch -OutputPath "$bridge\StartupBridge.exe"
```

第一组必须为 **14 项全部通过**，第二组为 **4 项全部通过**。分别保留 `functional/results.json` 和 `identity/identity-results.json` 供本机审查。任何命令失败就停止准备，不进入启用步骤。

默认不带 `-ExperimentalPatch` 的构建不会执行真实参数重建；`-SelfTest` 只用于自有进程测试。两种构建均不能代替最终启用候选。源码被换行转换或改动后，需要重新核对，不能沿用另一份源码的记录。

## 独立审查与本机记录

由另一位审查者检查当前源码、18 项测试结果、最终实验回调二进制和停止流程，然后计算实际文件的 SHA-256 和本机 OS build。审查者才可在此安装的 `official-startup/reviewed-candidate.json` 中记录：

| 字段 | 必须来自的实际证据 |
| --- | --- |
| `schemaVersion` / `status` | `1` / `isolated-passed`，仅在完整检查通过后填写 |
| `callbackSha256` | 本机最终 `StartupBridge.exe` 的 SHA-256 |
| `sourceSha256` | 本机安装目录 `StartupBridge.cs` 精确字节的 SHA-256 |
| `windowsBuild` / `architecture` | 已审查的 OS build `26200` / `x64` |
| `testCount` | 此流程实际通过的 `18` 项 |

这些值不能从本文、Release 或另一台机器的记录复制。不要上传记录和测试运行数据。当前实现核对哈希、OS build 和架构，**不包含设备身份绑定**；它是防止误用不匹配候选的检查，不是不可伪造的本机测试证明。代码目前接受至少 16 项的旧记录；本版发布流程要求现有完整 18 项，不能以旧下限跳过测试。

将独立核对的最终回调哈希赋给 `$reviewedHash`，进行只读预检：

```powershell
$reviewedHash = '独立审查得到的最终回调SHA256'
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "$bridge\Lease.ps1" -InstallRoot "$install" -CallbackPath "$bridge\StartupBridge.exe" -ExpectedCallbackSha256 $reviewedHash
```

预检必须识别当前注册包、已有商店登录档、正确文件哈希并显示 `enableEligible=true`。它不会启动客户端或启用调试。预检通过也不代表用户授权或实际背景已连接。

## 明确确认后启用

向用户说明精确包和候选、上述生命周期变化、只覆盖当前验证的开始菜单路径及关闭方法。取得授权并确认没有其他包调试器后，才运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "$install\Set-OfficialStartup.ps1" -InstallRoot "$install" -State On -ReviewedCallbackSha256 $reviewedHash -AcknowledgeLifecycleChanges -ConfirmNoOtherDebugger
```

只有用户还明确允许同一应用更新跟随时，才添加 `-AllowPackageUpdates`。此选项允许控制器在包版本变化后重新检查并建立新的精确包租约，不代表未来版本已经验收。源文件、回调哈希或 OS build 不匹配时仍须重新审查。

开启命令保存意向，由现有 companion 监督器持有租约；不新建独立的永久启动项。确认租约为 `active`，不能只把 `enabled=true` 当作成功。运行期间文件、包或 owner 变化时会撤销租约；只在有效授权范围内重新准备。

之后由用户保存工作并正常退出客户端及其托盘，再打开精确官方 MSIX 开始菜单入口。验收必须绑定这次新主进程，检查主题参数、挂件、fresh 额度、`backgroundConnected=true` 和实际图片。保留失败原因，不能通过强制结束客户端换取验收。

## 关闭、更新与回退

运行安装目录的 `Disable-OfficialStartup.cmd`，或：

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "$install\Set-OfficialStartup.ps1" -InstallRoot "$install" -State Off
```

关闭会停止后续启用并通知本组件拥有的 broker 撤销；核对 `released` 和 `DisableDebugging-succeeded`。若 broker 已消失或结果未知，保留本机状态并诊断，不能伪报恢复完成。该操作不关闭官方客户端，也不会自动移除本次运行已经带有的启动参数。

更新、卸载或回退前先关闭并核实释放。保留用户资料与独立审查证据；新候选需要重新核对，不分发或自动生成通用审查记录。
