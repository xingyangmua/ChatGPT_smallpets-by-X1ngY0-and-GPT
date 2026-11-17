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

## 1.1.0-beta.6

- 修复损坏安装记录使挂件和观察器一同失效的问题，保留损坏原件、恢复已有有效配置，并改进并发写入。
- 主题启动优先沿用原商店版登录档，避免误选普通启动生成的另一目录；保留现有登录资料。
- 额度模块异常与角色窗口解耦；恢复启动动画的独立播放与窗口尺寸跟随，不分发私人视频。
- 增加当前用户官方快捷方式的可选主题参数维护与回退，保留既有链接属性和用户自定义参数。
- 增加独立的 DSH 背景及可拖动角色适配包 `dsh-work-pet 0.1.0`，不接入 DSH 账号或额度。
- 提供默认关闭的官方 MSIX 开始菜单启动桥源码与本机验证流程。Windows 11 x64 build 26200 上的两次独立无参数冷启动已连接挂件、额度和背景；公开包不分发本机审查记录。
- 明确普通快捷方式、MSIX AUMID、原版 EXE 和 DSH 的验证边界。原版 EXE 直接无参数启动仍不支持；不宣称所有官方入口均已自动加载背景。

实际验证范围见 `docs/VERIFICATION.md`。源码、安装包和实机结果分别记录。

## 0.1.10

修复 Windows 顶部背景交界的阶梯状缺口。原有侧栏对齐规则只匹配工作区的直接子节点，新版客户端增加 flex 容器后留下 8px 顶部间距；新规则兼容该嵌套结构，仅作用于已展开的停靠侧栏，并排除浮动和窥视状态。12 种隔离布局检查通过，当前客户端实测两侧顶部对齐，用户确认缺口消失。

按官方返回的 Pro 会员类型（pro / prolite）选择额度展示，仅保留每周额度窗口，隐藏五小时额度及对应低额度提醒；切换为其他会员时恢复原显示。每周数据缺失或过期时仍明确标记暂不可用，不根据缺少五小时数据猜测会员类型。重置次数的原有展示保留。
