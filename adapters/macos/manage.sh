#!/bin/bash
set -eu
umask 077
if [[ $(/usr/bin/uname -s) != Darwin || $(/usr/bin/id -u) == 0 ]]; then
  echo "请从当前 Mac 登录用户运行，无需 sudo。" >&2
  exit 1
fi

root="$HOME/Library/Application Support/Codex Work Pet"
label=io.github.xingyangmua.work-pet
service="gui/$(/usr/bin/id -u)/$label"
app=
for candidate in /Applications/ChatGPT.app "$HOME/Applications/ChatGPT.app"; do
  if [[ -f "$candidate/Contents/Info.plist" ]] &&
     [[ $(/usr/bin/plutil -extract CFBundleIdentifier raw "$candidate/Contents/Info.plist") == com.openai.codex ]]; then
    app="$candidate"
    break
  fi
done
if [[ -z "$app" ]]; then
  echo "需要已安装的官方 ChatGPT 桌面应用。" >&2
  exit 1
fi
node=
for candidate in "$app/Contents/Resources/cua_node/bin/node" "$(command -v node || true)" /opt/homebrew/bin/node /usr/local/bin/node; do
  if [[ -x "$candidate" ]] && "$candidate" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 24 ? 0 : 1)'; then
    node="$candidate"
    break
  fi
done
if [[ -z "$node" ]]; then
  echo "需要 ChatGPT 自带的 Node 或本机 Node 24 及以上版本。" >&2
  exit 1
fi

component="$root/current/adapters/macos"
export WORK_PET_ASSETS="$root/current/app/widget/assets"
export WORK_PET_STATE="$root/state"
action=${1:-status}
case "$action" in
  install)
    exec "$node" "$2/adapters/macos/setup.mjs" install "$app" "$2"
    ;;
  uninstall)
    exec "$node" "$component/setup.mjs" uninstall "$app"
    ;;
  run)
    exec "$node" "$component/supervise.mjs" "$app"
    ;;
  status)
    loaded=false
    if /bin/launchctl print "$service" >/dev/null 2>&1; then loaded=true; fi
    probe=$(/usr/bin/osascript -l JavaScript "$component/pet.js" --probe)
    exec "$node" -e '
      const serviceLoaded = process.argv[1] === "true";
      const pet = JSON.parse(process.argv[2]);
      console.log(JSON.stringify({serviceLoaded, ...pet}));
      if (!serviceLoaded || !pet.running) process.exitCode = 1;
    ' "$loaded" "$probe"
    ;;
  show|hide|reset-position)
    if ! /bin/launchctl print "$service" >/dev/null 2>&1; then
      echo "Work Pet 后台服务没有加载。请运行 Install-macOS.command 重新安装。" >&2
      exit 1
    fi
    exec /usr/bin/osascript -l JavaScript "$component/pet.js" "--$action"
    ;;
  *)
    echo "支持的命令为 status、show、hide、reset-position 和 uninstall。" >&2
    exit 2
    ;;
esac
