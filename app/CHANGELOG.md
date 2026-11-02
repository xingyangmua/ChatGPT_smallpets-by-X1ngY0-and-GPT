# 1.1.0-beta.1

First generic codex_work_pet release preparation. Custom background and native-default choice, replaceable four-expression pet, persistent master switch, quota/low-warning/easter interaction, GUI settings entry, portable embedded runtime, checked bootstrap and rollback. Existing historical internal data keys are retained for migration compatibility.


## 内置素材精简（发布前更新）

背景选项仅保留 ChatGPT 默认背景和蓝天草地（IMG3575.jpg）。内置挂件角色仅保留当前疑问形象（IMG3576.png）；四个可自定义槽默认共用这一张，点击音效、弹性反馈和彩蛋继续生效。其他背景、表情和旧装饰 GIF 不随本版本分发。自选背景、替换角色/气泡的能力保留。


发布前彩蛋文案更新：新增 `kskbl` 和 `zdjd`，保持每 2–5 次有效点击随机触发；气泡只显示彩蛋文字，不添加解释小字。项目宣传名称为「gpt自定义插件」；代码与安装文件继续使用 codex_work_pet。

## 1.1.0-beta.2

修复商店更新后旧版 CLI 路径失效、额度事件刷新循环与账号切换竞态；背景支持受验证会话重连，未接入窗口明确提示待安全重启；新增 ChatGPT (Work Pet) 搜索入口和程序图标。修复旧 PID 阻断背景恢复、发布版本不一致和测试目录残留。详见 docs/BUGFIX-2026-11-01.md。

## 1.1.0-beta.3

修正 Windows 云端测试中 8.3 临时路径、真实路径和路径大小写的比较；保留严格的文件目标校验。README、AGENTS、AI 安装流程和包内说明同步为新版，分清真实额度、背景待安全重启、源码推送与附件发布。


## 1.1.0-beta.5

修复冷启动重复普通激活，新增客户端生命周期背景重连、失败阶段与原因保留、离线保存待应用壁纸。当前 Store 客户端的 Work Pet 冷启动注入与渲染通过，552 项测试和 27 项隔离界面检查通过；官方全部入口的无条件背景冷启动加载尚未实现。详见 docs/BACKGROUND-2026-11-02.md。
