@AGENTS.md

## Claude Code だけの注意

ルールの本体は `AGENTS.md`。ここには、Claude Code の設定に関わることだけを書く。

- **動かす場所**：Dev Container の中で動かすのが基本（VS Code の拡張機能は `.devcontainer/devcontainer.json` に入れてある。ログイン情報はボリュームに残る）。コンテナの外で動いているときは、コマンドの前に `scripts/in-container.sh` を付ける
- **権限**（`.claude/settings.json`）：デプロイとリモートの操作（`npm run deploy`・`setup`・`destroy`、`wrangler deploy`、`--remote`、`wrangler secret`）と、`.env`・`.dev.vars` を読むことを拒否している。拒否されたら、別の書き方で通そうとせず、人間に頼む
- **編集後のフック**：ファイルを編集すると、Biome（整形と Lint の自動修正）がそのファイルにかかる（`scripts/format-edited.ts`）。直せない指摘が残ると、その内容が返ってくるので、その場で直す。コンテナの外では動かないので、最後に `npm run check` を通す
- 個人用の設定は `.claude/settings.local.json` に書く（コミットしない）
