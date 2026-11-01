# 重建与发布 1.1.0-beta.2

源码不包含二进制运行时。使用 Python 3.11 或更高版本，准备 Electron 44.3.0 官方 Windows x64 完整 ZIP，保留许可证。该运行时 SHA-256：

```text
26bf9a617d58d81772b3d68305d59ee48272969c15083c06db634a77358a8d9d
```

在源码根目录执行：

```text
node --test app/widget/tests/*.test.mjs
python tools/build_release.py --electron-archive electron-runtime.zip --output dist --version 1.1.0-beta.2
```

生成完整 Windows ZIP、SHA256SUMS.txt 和 release.json，并更新仓库根 release.json。发布前提交更新后的清单，确保版本、标签、附件名和 SHA-256 一致。源码变更若进入 app 目录，必须重建安装包和清单；仅修改根 README 不会自动更新包内 README。

打包按固定顺序和时间戳写入文件，规范文本换行，排除个人 data、备份、QA、日志和开发运行时目录。应从待发布 Git 树重建一次，核对与本地包相同的 SHA-256。更换 Electron 版本需重新验收。

`.github/workflows/release.yml` 在推送 `v*` 标签后测试、下载固定哈希的官方运行时、重建并核对仓库清单，然后发布含 ZIP 和校验文件的 prerelease。手动运行 workflow_dispatch 只构建验证，不自动发布。不要在 Actions 失败时宣称 Release 已生成；检查附件大小和下载哈希后交付。

保留已发布版本的不可变性。更新已发布版本的附件或重写标签前，先确认用户明确授权；常规后续修改应使用新版本。

界面示例来自独立测试窗口，额度数字为测试数据。不得将真实登录、聊天、账号标识、个人用量快照或截图放入公开包。
