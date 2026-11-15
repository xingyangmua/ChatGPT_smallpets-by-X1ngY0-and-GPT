# Work Pet for DSH

独立的 DeepSeek Harness 装饰插件 `dsh-work-pet@0.1.0`，提供本仓库的背景与可拖动角色。它使用 DSH 官方页面注入接口，不需要 ChatGPT 的远程调试端口，也不启动 Codex 额度服务。

支持范围：DSH 0.2.1-rc.2 起的 0.2 系列；本轮已验证 DSH NEXT 2.0.19-next 内置的 DSH 0.2.1-rc.2 / Cordis 4.0.5 SDK，以及独立 Electron 测试页。**尚未安装到用户现用的 DSH desktop profile，也未宣称真实 DSH 会话验收完成。**

## 功能

- 左下角角色可拖动；点击角色或 `Work Pet` 按钮打开设置。
- 背景、角色各自开关，背景浓度调节。
- 选择不超过 1.6 MB 的 PNG、JPG、WebP、GIF 替换角色或背景；图片与位置仅存入本页面自己的 localStorage。
- 恢复内置图片与位置。
- 已有 `dsh-video-skin` 背景存在时，保留它，本插件背景暂不显示。原有鲸鱼余额插件保持独立。

本包不读取 DSH_HOME、provider 配置、API key、账号、聊天记录或额度；也不请求模型、不发送消息、不显示伪造的 DSH/Codex 额度。内置图片来自本仓库已有 `IMG3575.jpg`、`IMG3576.png`，安装包不带私人动画或用户配置。

代码的 MIT 许可不改变示例图片的素材权利范围；详见随包 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 安装与启用

使用发布附件 `dsh-work-pet-0.1.0.tgz`，或源码中的完整 `adapters/dsh` 目录。插件没有外部运行依赖、下载脚本或构建脚本，内置图片随包提供。

**DSH NEXT 桌面端：** 使用该桌面端自己的插件管理能力，把本地 tgz 路径作为安装规格，安装进当前 `desktop` profile。也可以在 DSH 内明确要求其通过 `plugin_manager` 安装这个本地包。不要把桌面插件误装进 `web` profile，不要手工覆盖现有 profile 文件，也不要借用电脑上版本不同的旧全局 `dsh` 来修改桌面配置。安装完成后，在没有正在执行任务时安全退出并重新打开 DSH NEXT，让启动注入表重新加载。

**独立 DSH Web：** 用当前 Web 安装对应的 DSH CLI：

```powershell
dsh plugin --profile web add "C:\Downloads\dsh-work-pet-0.1.0.tgz"
```

或者安装本地源码目录：

```powershell
dsh plugin --profile web add "file:C:\Projects\ChatGPT_smallpets-by-X1ngY0-and-GPT\adapters\dsh"
```

重新启动自己的 Web 实例并刷新页面。上面是安装说明，本仓库测试不会执行这些命令或修改现用 DSH。

## 检查与关闭

进入真实 DSH 窗口后，检查角色图片实际出现、拖动后位置保持、背景开关生效，以及原有对话和设置可读。若已有视频皮肤，设置中会说明背景已让位；这不是新背景已显示的证明。

临时关闭可在 Work Pet 设置中取消两个开关。卸载使用相同桌面端的插件管理入口；独立 Web 可运行：

```powershell
dsh plugin --profile web remove dsh-work-pet
```

随后安全重启对应 DSH 页面/应用。卸载不会清除该页面已保存的本地图片与位置；重新安装可以继续使用。运行时只增加自己的 DOM、CSS 标记及监听器，不替换 DSH 应用文件。

## 开发与打包

```powershell
node --test adapters/dsh/tests/*.test.mjs
cd adapters/dsh
npm pack --ignore-scripts
```

`pnpm pack` 同样生成标准 npm tgz。包内应包含两个 `assets` 图片、`index.mjs`、`runtime.mjs`、`style.css`、`cordis.patch.yml`、README 和 LICENSE；没有源码仓库外的相对资源依赖。

本轮测试：4 项 Node 回归通过；本机实际 DSH SDK 的 `collectIndexInjections` / `renderIndex` 集成通过；隔离 Electron 页面验证了内置图片、背景开关、设置、拖动、视频皮肤共存、清理函数，并检查了截图。以上不替代现用 DSH 的真实验收。

接口依据：[官方 webserver 契约](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/host/webserver/README.md)、[结构化页面注入类型](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/host/webserver/src/injections.ts)、[官方插件打包流程](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)。实际兼容检查同时依据本机已安装的 0.2.1-rc.2 代码，未把上游主分支等同于本机版本。
