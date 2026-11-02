# 1.1.0-beta.5 验证范围

本轮在 Windows 11 x64、注册的 OpenAI.Codex 26.1023.6621.0 上验证。真实结果与隔离检查分开记录。

## 已通过

- 用户安全退出后从 Work Pet 冷启动，主题参数正确转发；background-probe.json 的 stage=injected、ok=true，background-verify.json 的 pass=true、stylePresent=true，文档、视口、侧栏和输入框结构就绪。
- 随后 Status.ps1 确认 backgroundConnected=true、quotaStatus=fresh、quotaProcessRunning=true、widgetVisible=true、widgetSurfaceReady=true。
- 552 项 Node 测试通过，包括冷启动不重复普通激活、背景助手的生命周期/退避/超时、失败诊断保留、离线保存图片及重连后应用、已连接时失败回滚。
- Electron 44.3.0 独立测试目录完成 27 项交互检查。新增离线背景设置真实窗口检查，截图确认“已保存、等待连接”提示及图片预览；保留点击、拖拽、音效、额度/彩蛋、设置、总开关与重载等检查。
- 本机候选修复安装时对旧文件备份，逐文件 SHA-256 相符；当前客户端未被强制结束，登录和聊天未复制进发布材料。

## 尚未完成或不作保证

- 官方 MSIX 搜索、原固定图标、通知等所有冷启动入口的无条件背景加载尚未实现。
- 只有已开放可信主题端口的会话才能自动重连；普通会话可能仍需安全退出后从管理入口启动。
- 全部真实手动换图、原生默认背景及模式切换路径尚未逐项验收；隔离界面通过不能替代这些实机项目。
- 其他设备、系统与客户端版本没有据此获得兼容保证。

安装包、源码推送和 Release 附件必须按 BUILD.md 单独核对。真实背景连接不等于所有入口或所有操作均已验证。
