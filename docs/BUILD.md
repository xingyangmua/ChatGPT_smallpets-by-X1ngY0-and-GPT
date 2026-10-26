# 重建 Release

源码不包含二进制运行时。准备 Electron 44.3.0 的官方 Windows x64 完整 ZIP（包含许可证），使用 Python 3.11 或更高版本：

```text
python tools/build_release.py --electron-archive 完整运行时.zip --output dist --version 1.1.0-beta.1
```

脚本生成完整安装包和 SHA256SUMS.txt，并更新根 release.json。修改后的 release.json 必须与源码一起提交；Release 标签、附件名、版本和 SHA-256 必须匹配。更换 Electron 版本需要重新验收。打包不会读取开发者的安装目录、登录文件或用量数据。

截图位于 docs/images，均来自本组件自己的隔离测试窗口，数字是测试数据，不是维护者账号用量。
