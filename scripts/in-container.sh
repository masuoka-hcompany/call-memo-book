#!/bin/sh
# コンテナの外（ホストの WSL など）から、開発用コンテナの中でコマンドを実行する。
# node_modules はコンテナの中にしかないので、テスト・型チェック・Lint はコンテナの中で動かす。
#
# 例: scripts/in-container.sh npm run check
#
# 先に docker compose up -d でコンテナを起動しておくこと。
set -eu

cd "$(dirname "$0")/.."

if [ "$#" -eq 0 ]; then
  echo "使い方: scripts/in-container.sh <コマンド>（例: scripts/in-container.sh npm run check）" >&2
  exit 2
fi

if [ -z "$(docker compose ps --status running -q app 2>/dev/null)" ]; then
  echo "開発用コンテナが起動していません。先に docker compose up -d を実行してください。" >&2
  exit 1
fi

exec docker compose exec -T app "$@"
