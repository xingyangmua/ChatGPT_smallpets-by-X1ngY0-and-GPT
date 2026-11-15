# 重建与发布 1.1.0-beta.6

使用 Python 3.11 或更高版本。Windows 完整包使用固定的 Electron 44.3.0 Windows x64 官方 ZIP，并保留许可证，SHA-256 为：

```text
26bf9a617d58d81772b3d68305d59ee48272969c15083c06db634a77358a8d9d
```

在经过审查的待发布 Git 树中执行：

```text
node --test app/widget/tests/*.test.mjs
python tools/build_release.py --electron-archive electron-runtime.zip --output dist --version 1.1.0-beta.6
```

版本必须同步到 widget 元数据、锁文件、运行时常量、安装收据及根/包内文档。根 `release.json` 在最终构建时生成；不要预填或沿用旧 ZIP 的 SHA-256。

Windows ZIP 与源码提交都排除用户 data、备份、日志、截图、私人视频、临时验收任务和本机审查记录。

保留 `app/official-startup` 中的源码、构建/测试/租约/停止脚本，以及配套控制器、维护脚本和回归检查。官方 MSIX 入口已取得两次独立真实冷启动连接成功证据；桥作为实验功能默认关闭。不能剥离启用流程依赖文件后再宣称该功能可用。

发布绝不包含 `official-startup/StartupBridge.exe`、`official-startup/reviewed-candidate.json` 或 data 中的 consent/lease/policy/evidence。根构建器与安装器已排除回调 EXE 和该审查记录；发行检查仍须核对最终 ZIP 目录。目标机以解包后精确源码重新编译并完成 18 项隔离测试，独立审查后生成该机使用的记录。不得把开发机记录复制到 Release，也不得在安装过程中自动生成记录或替用户开启。

当前审查门槛核对源码/回调 SHA-256、Windows build 和 x64 架构，不包含设备身份，不能描述为防篡改的本机测试证明。当前证据范围为 build 26200；其他系统版本须另行结构审查与验证，不能仅把本机版本号填进记录。

`Build-Entries.ps1` 不调用启动桥的实验构建，不生成审查记录，不写入开启设置。安装器在写入前检查已有开启/损坏设置及活动或未确认释放的租约，并持有与 broker 相同的互斥锁。已有桥二进制和记录保留在原目录及更新备份中，默认源码包不重建或替换它们；源码改变后旧记录不能通过新的哈希校验。用户应先明确关闭并核实释放，再更新。

不要直接把整个工作目录作为发布输入。打包按固定顺序和时间戳写入文件并规范文本换行。先明确提交文件，再从该 Git 树重建并核对可复现 SHA-256，检查 ZIP 目录和许可证。DSH 适配器位于 `adapters/dsh`，采用独立版本和 npm 包清单；Windows 的 `app` 打包路径不会自动包含它，须另行打包及验证。

维护者可以通过两种明确入口发布 prerelease：推送对应的 `v*` 版本标签；或将已审查的发行提交推送到 `main`，并在该次提交消息中明确加入 `[release]`。普通 `main` 提交只验证，`workflow_dispatch` 手动运行也只构建验证，不发布。

`main` 的显式发布路径根据已核验的 `release.json` 使用版本标签，以本次 `GITHUB_SHA` 为目标。创建前必须确认同名标签不存在，或解析后精确指向本次提交；同名 Release 已存在时停止，不覆盖附件或移动标签。此入口同样须先通过测试、完整构建及 manifest SHA-256 核对，不能凭提交标记跳过验证。

发布前核对标签、版本、附件名和 manifest，发布后检查 Actions 结果、附件大小及回下载哈希。保留已发布 beta.5 的标签和附件。
