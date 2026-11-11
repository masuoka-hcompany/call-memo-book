// 全画面で共通のレイアウト：ヘッダー（ロゴ・メニュー・ログイン中の利用者名・モック用のログインユーザー切替）と本文
// 見た目のルールは docs/design.md 4.6。

import type { Child } from "hono/jsx";
import type { User } from "../repo/types.ts";
import { FlashMessage, MockBox } from "./components.tsx";
import { Document } from "./Document.tsx";
import { MOCK_LABELS } from "./labels.ts";
import { MENU, type NavKey } from "./screens.ts";

export const MOCK_USER_SWITCH_PATH = "/__mock/login-user";

export type MockSwitch = {
  users: User[];
  // 切り替えたあとに戻る URL（いまの画面）
  back: string;
};

type HeaderProps = {
  nav: NavKey | null;
  currentUser: User;
  // MOCK_MODE=true のときだけ渡す
  mock: MockSwitch | null;
};

export function AppHeader({ nav, currentUser, mock }: HeaderProps) {
  return (
    <header class="border-b border-base-300 bg-base-100">
      {/* PC の幅（1,024px 程度）でも折り返さないようにする */}
      <div class="mx-auto flex max-w-6xl items-end justify-between gap-6 whitespace-nowrap px-6 pt-4">
        <div class="flex items-end gap-8">
          <span class="flex items-center gap-2 pb-3">
            <span class="inline-block size-2.5 bg-primary" aria-hidden="true" />
            call memo book（仮）
          </span>
          <nav aria-label="メニュー">
            <ul class="flex gap-5">
              {MENU.map((item) => (
                <li>
                  <a
                    href={item.href}
                    class="nav-item inline-block pb-3"
                    aria-current={item.key === nav ? "page" : undefined}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div class="flex items-center gap-4 pb-2">
          {/* ログイン中の利用者名（仕様書 7.1） */}
          <span data-testid="current-user">{currentUser.name}</span>
          {mock && <MockUserSwitch users={mock.users} currentUserId={currentUser.id} back={mock.back} />}
        </div>
      </div>
    </header>
  );
}

// モック用：ログインユーザー切替（選ぶとすぐ切り替える）
function MockUserSwitch({ users, currentUserId, back }: { users: User[]; currentUserId: number; back: string }) {
  return (
    <MockBox>
      <form method="post" action={MOCK_USER_SWITCH_PATH} class="flex items-center gap-2">
        <input type="hidden" name="back" value={back} />
        <label for="mock-user-switch">{MOCK_LABELS.userSwitch}</label>
        <select id="mock-user-switch" name="user" class="select select-sm w-24" onchange="this.form.requestSubmit()">
          {users.map((u) => (
            <option value={String(u.id)} selected={u.id === currentUserId}>
              {u.name}
            </option>
          ))}
        </select>
      </form>
    </MockBox>
  );
}

export type AppLayoutProps = HeaderProps & {
  // <title> と画面の見出し（画面名。仕様書 7.1）
  title: string;
  // 完了メッセージ
  flash?: string | null;
  children?: Child;
};

export function AppLayout({ title, nav, currentUser, mock, flash, children }: AppLayoutProps) {
  return (
    <Document title={title}>
      <AppHeader nav={nav} currentUser={currentUser} mock={mock} />
      <main class="mx-auto max-w-6xl px-6 py-8">
        <h1 class="mb-6 text-2xl font-bold">{title}</h1>
        {flash && <FlashMessage message={flash} />}
        {children}
      </main>
    </Document>
  );
}
