#!/bin/bash
set -eu
package_root=$(cd "$(dirname "$0")" && pwd -P)
exec /bin/bash "$package_root/adapters/macos/manage.sh" install "$package_root"
