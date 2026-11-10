// /__styleguide：デザインの見本（モック専用。MOCK_MODE=true のときだけ表示する）
// ルールは docs/design.md。ここに並べた部品の見た目を、各画面でそのまま使う。
// 見出しや「通常」「hover」などの説明はこの見本だけの文言で、画面には出さない。

import { Hono } from "hono";
import type { Child } from "hono/jsx";
import { mockOnly } from "../mock/mode.ts";
import type { AppEnv } from "../types.ts";
import { Document } from "../views/Document.tsx";
import { LABELS } from "../views/labels.ts";

export const styleguide = new Hono<AppEnv>();

styleguide.use("/__styleguide", mockOnly);

// hover・入力中・focus は疑似クラスなので、見本では同じ見た目を固定して並べる（値は app.css と同じ）。
// 実際の操作での見た目は、各部品を hover・Tab で確かめる。
const STATIC_STATE_CSS = `
.sg-hover.input, .sg-hover.select, .sg-hover.textarea { border-color: #6B6B66; }
.sg-focus.input, .sg-focus.select, .sg-focus.textarea { border-color: #1C1C1B; box-shadow: inset 0 0 0 1px #1C1C1B; }
.sg-hover.input-error { border-color: #C2361F; }
.sg-focus.input-error { border-color: #C2361F; box-shadow: inset 0 0 0 1px #C2361F; }
.sg-hover.btn-plain:not(:disabled) { background-color: #F0F0EC; }
.sg-hover.btn-quiet:not(:disabled) { background-color: #DCDCD7; }
.sg-hover.btn-primary:not(:disabled) { --btn-bg: color-mix(in oklab, var(--btn-color, var(--color-base-200)), #000 7%); }
.sg-focus.btn { outline: 2px solid #1C1C1B; outline-offset: 2px; }
.sg-static-dialog { position: static; display: block; opacity: 1; transform: none; max-width: 32rem; }
`;

const PALETTE = [
  { name: "面", hex: "#FAFAF8" },
  { name: "区画", hex: "#F0F0EC" },
  { name: "押せる面", hex: "#E6E6E1" },
  { name: "線", hex: "#DCDCD7" },
  { name: "フォーム枠", hex: "#8A8A84" },
  { name: "補助", hex: "#6B6B66" },
  { name: "黒", hex: "#1C1C1B" },
  { name: "赤", hex: "#C2361F" },
  { name: "緑", hex: "#2B784C" },
  { name: "黄", hex: "#F1CE3C" },
] as const;

const MENU = ["相手検索", "取次メモ一覧", "会社一覧", "宛先一覧"] as const;
const USERS = ["菊地", "益岡", "木村"] as const;

function Section({ id, title, children }: { id: string; title: string; children: Child }) {
  return (
    <section id={id} class="mb-12">
      <h2 class="mb-4 border-b-2 border-base-content pb-1 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Caption({ children }: { children: Child }) {
  return <p class="mb-1 text-sm text-secondary">{children}</p>;
}

function PendingBadge({ id, label }: { id: string; label: string }) {
  return (
    <span class="badge badge-warning">
      【未決】{id} {label}
    </span>
  );
}

// 取次可否の値
type Setting = "つなぐ" | "つながない" | "未設定";

function Verdict({ value }: { value: Setting }) {
  if (value === "つながない") return <span class="verdict verdict-ng">✕ つながない</span>;
  if (value === "つなぐ") return <span class="verdict verdict-ok">● つなぐ</span>;
  return <span class="verdict verdict-unset">― 未設定</span>;
}

function Breakdown({ person, company }: { person: Setting; company: Setting }) {
  // 優先ルール（仕様書 3章）：担当者が「未設定」以外なら担当者、「未設定」なら会社を採用する
  const personAdopted = person !== "未設定";
  return (
    <span class="source-value">
      {personAdopted ? <span class="source-adopted">担当者：{person} ← 採用</span> : <>担当者：{person}</>}
      {"　／　"}
      {personAdopted ? <>会社：{company}</> : <span class="source-adopted">会社：{company} ← 採用</span>}
    </span>
  );
}

const VERDICT_PATTERNS: { caption: string; to: string; person: Setting; company: Setting }[] = [
  { caption: "両方未設定", to: "菊地", person: "未設定", company: "未設定" },
  { caption: "会社のみ設定", to: "社長", person: "未設定", company: "つながない" },
  { caption: "担当者のみ設定", to: "菊地", person: "つなぐ", company: "未設定" },
  { caption: "両方設定で会社と担当者が逆", to: "社長", person: "つなぐ", company: "つながない" },
];

function Header() {
  return (
    <header class="border-b border-base-300 bg-base-100">
      <div class="mx-auto flex max-w-6xl items-end justify-between gap-6 px-6 pt-4">
        <div class="flex items-end gap-10">
          <span class="flex items-center gap-2 pb-3">
            <span class="inline-block size-2.5 bg-primary" aria-hidden="true" />
            call memo book（仮）
          </span>
          <nav aria-label="メニュー">
            <ul class="flex gap-6">
              {MENU.map((name, i) => (
                <li>
                  <a href="#header" class="nav-item inline-block pb-3" aria-current={i === 0 ? "page" : undefined}>
                    {name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div class="flex items-center gap-4 pb-2">
          <span>菊地</span>
          {/* モック専用：黄の破線で囲み、仕様の画面要素と区別する */}
          <label class="flex items-center gap-2 border border-dashed border-warning bg-warning/20 px-2 py-1 text-sm">
            <span>モック用：ログインユーザー切替</span>
            <select class="select select-sm w-24">
              {USERS.map((u) => (
                <option>{u}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </header>
  );
}

function InputStates() {
  const states = [
    { caption: "通常", cls: "", value: "" },
    { caption: "hover（見本）", cls: "sg-hover", value: "" },
    { caption: "入力中（見本）", cls: "sg-focus", value: "原田工務店" },
  ];
  return (
    <div class="grid grid-cols-3 gap-6">
      {states.map((s) => (
        <div>
          <Caption>{s.caption}</Caption>
          <label class="block">
            <span class="mb-1 block text-sm">会社名</span>
            <input type="text" class={`input w-full ${s.cls}`} value={s.value} />
          </label>
        </div>
      ))}
      {[
        { caption: "エラー", cls: "" },
        { caption: "エラー＋hover（見本）", cls: "sg-hover" },
        { caption: "エラー＋入力中（見本）", cls: "sg-focus" },
      ].map((s) => (
        <div>
          <Caption>{s.caption}</Caption>
          <label class="block">
            <span class="mb-1 block text-sm">会社名のよみがな</span>
            <input type="text" class={`input input-error w-full ${s.cls}`} value="ハラダ" aria-invalid="true" />
          </label>
          <p class="error-text mt-1 text-sm">会社名のよみがなはひらがなで入力してください</p>
        </div>
      ))}
      <div>
        <Caption>disabled</Caption>
        <label class="block">
          <span class="mb-1 block text-sm">会社名</span>
          <input type="text" class="input w-full" value="原田工務店" disabled />
        </label>
      </div>
      <div>
        <Caption>プルダウン</Caption>
        <label class="block">
          <span class="mb-1 block text-sm">宛先</span>
          <select class="select w-full">
            <option>菊地</option>
            <option>社長</option>
          </select>
        </label>
      </div>
      <div>
        <Caption>複数行</Caption>
        <label class="block">
          <span class="mb-1 block text-sm">伝言</span>
          <textarea class="textarea w-full" rows={2} />
        </label>
      </div>
    </div>
  );
}

function ButtonRow({ kind, label, cls }: { kind: string; label: string; cls: string }) {
  return (
    <tr>
      <th class="py-3 pr-6 text-left font-normal">{kind}</th>
      <td class="py-3 pr-6">
        <button type="button" class={`btn ${cls}`}>
          {label}
        </button>
      </td>
      <td class="py-3 pr-6">
        <button type="button" class={`btn ${cls} sg-hover`} tabindex={-1}>
          {label}
        </button>
      </td>
      <td class="py-3 pr-6">
        <button type="button" class={`btn ${cls} sg-focus`} tabindex={-1}>
          {label}
        </button>
      </td>
      <td class="py-3 pr-6">
        <button type="button" class={`btn ${cls}`} disabled>
          {label}
        </button>
      </td>
    </tr>
  );
}

function DeleteDialogBody() {
  return (
    <>
      <p>この会社を削除しますか？ 所属する担当者も削除されます</p>
      <div class="modal-action">
        <form method="dialog" class="flex gap-2">
          <button type="submit" class="btn btn-quiet">
            {LABELS.cancel}
          </button>
          <button type="submit" class="btn btn-plain">
            削除する
          </button>
        </form>
      </div>
    </>
  );
}

styleguide.get("/__styleguide", (c) => {
  return c.html(
    <Document title="スタイルガイド">
      <style>{STATIC_STATE_CSS}</style>
      <div id="header">
        <Header />
      </div>
      <main class="mx-auto max-w-6xl px-6 py-8">
        <p class="mb-8 text-sm text-secondary">
          モック専用の見本ページ。ルールは docs/design.md。「（見本）」は疑似状態を固定して表示したもの。
        </p>

        <Section id="palette" title="パレット">
          <ul class="grid grid-cols-5 gap-4">
            {PALETTE.map((p) => (
              <li>
                <span class="block h-12 border border-base-300" style={`background-color:${p.hex}`} />
                <span class="mt-1 block text-sm">
                  {p.name} <span class="tabular text-secondary">{p.hex}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="search" title="S-01 の検索欄（大）">
          <form class="flex max-w-2xl gap-2" novalidate onsubmit="return false">
            <input type="search" class="input input-lg w-full" aria-label="相手検索" value="原田" />
            <button type="submit" class="btn btn-lg btn-plain">
              {LABELS.search}
            </button>
          </form>
        </Section>

        <Section id="inputs" title="入力欄">
          <InputStates />
        </Section>

        <Section id="buttons" title="ボタン">
          <table>
            <thead>
              <tr class="text-left text-sm text-secondary">
                <th class="pr-6 font-normal" />
                <th class="pr-6 font-normal">通常</th>
                <th class="pr-6 font-normal">hover（見本）</th>
                <th class="pr-6 font-normal">focus（見本）</th>
                <th class="pr-6 font-normal">disabled</th>
              </tr>
            </thead>
            <tbody>
              <ButtonRow kind="主要（1画面1つ）" label="取次メモを作成" cls="btn-primary" />
              <ButtonRow kind="通常" label="編集" cls="btn-plain" />
              <ButtonRow kind="補助" label={LABELS.cancel} cls="btn-quiet" />
            </tbody>
          </table>
        </Section>

        <Section id="results" title="検索結果の行">
          <table class="w-full max-w-3xl">
            <thead>
              <tr class="border-b border-base-300 text-left text-sm text-secondary">
                <th class="px-3 py-2 font-normal">会社名</th>
                <th class="px-3 py-2 font-normal">担当者名</th>
                <th class="px-3 py-2 font-normal">電話番号</th>
              </tr>
            </thead>
            <tbody>
              <tr class="row-selected border-b border-base-300">
                <td class="px-3 py-2">
                  <a href="#results" aria-current="true">
                    原田工務店
                  </a>
                </td>
                <td class="px-3 py-2">原田 一郎</td>
                <td class="tabular px-3 py-2">0312345678</td>
              </tr>
              <tr class="border-b border-base-300">
                <td class="px-3 py-2">
                  <a href="#results">原田設備</a>
                </td>
                <td class="px-3 py-2">原田 花子</td>
                <td class="tabular px-3 py-2">09012345678</td>
              </tr>
            </tbody>
          </table>
          <Caption>1行目が選択中、2行目が通常</Caption>
        </Section>

        <Section id="verdict" title="S-01 の取次可否（判定列）">
          <p class="mb-4">
            <PendingBadge id="Q-M01" label="採用値の強調（判定列）" />
          </p>
          <div class="grid grid-cols-2 gap-8">
            {VERDICT_PATTERNS.map((p) => (
              <div>
                <Caption>{p.caption}</Caption>
                <table class="w-full">
                  <tbody>
                    <tr class="border-b border-base-300">
                      <td class="py-2 pr-4 font-bold">{p.to}</td>
                      <td class="py-2 pr-4">
                        <Verdict value={p.person !== "未設定" ? p.person : p.company} />
                      </td>
                      <td class="py-2">
                        <Breakdown person={p.person} company={p.company} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </Section>

        <Section id="status" title="取次メモの状態">
          <p class="flex gap-8">
            <span class="status-open">● 未対処</span>
            <span class="status-done">✓ 対処済み</span>
          </p>
        </Section>

        <Section id="flash" title="完了メッセージ">
          <p class="flash-done max-w-2xl px-4 py-3" role="status">
            取次メモを登録しました
          </p>
        </Section>

        <Section id="dialog" title="確認ダイアログ">
          <p class="mb-4">
            <PendingBadge id="Q-M03" label="確認ダイアログのボタン名" />
          </p>
          <div class="mb-6 flex gap-2">
            <button
              type="button"
              class="btn btn-plain"
              onclick="document.getElementById('sg-delete-dialog').showModal()"
            >
              削除
            </button>
          </div>
          <dialog id="sg-delete-dialog" class="modal">
            <div class="modal-box">
              <DeleteDialogBody />
            </div>
          </dialog>
          <Caption>開いた状態（見本）</Caption>
          <div class="modal-box sg-static-dialog">
            <DeleteDialogBody />
          </div>
        </Section>

        <Section id="badge" title="【未決】バッジ（モック専用）">
          <PendingBadge id="Q-M01" label="採用値の強調" />
        </Section>
      </main>
    </Document>,
  );
});
