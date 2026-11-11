// 宛先の画面（S-10 宛先一覧、S-11 宛先追加・編集）

import { type Context, Hono } from "hono";
import { selectableUsers, validateNewRecipient, validateRecipientName } from "../domain/recipient.ts";
import {
  createRecipient,
  deleteRecipient,
  findRecipient,
  listRecipients,
  listRecipientsIncludingDeleted,
  updateRecipientName,
} from "../repo/recipients.ts";
import { listUsers } from "../repo/users.ts";
import type { AppEnv } from "../types.ts";
import { RecipientFormPage } from "../views/RecipientFormPage.tsx";
import { RecipientListPage } from "../views/RecipientListPage.tsx";
import { screen } from "../views/screens.ts";
import { renderPage, setFlash } from "./page.tsx";

export const recipients = new Hono<AppEnv>();

const ID = ":id{[0-9]+}";

// ---------- S-10 宛先一覧 ----------

recipients.get("/recipients", async (c) => {
  const s = screen("S-10");
  return renderPage(c, {
    title: s.name,
    nav: s.nav,
    children: <RecipientListPage recipients={await listRecipients()} users={await listUsers()} />,
  });
});

// 削除（確認ダイアログの「削除する」）：S-10 宛先一覧に戻り「宛先を削除しました」
recipients.post(`/recipients/${ID}/delete`, async (c) => {
  const id = Number(c.req.param("id"));
  if (!(await deleteRecipient(id, c.var.currentUser.id, new Date()))) return c.notFound();
  setFlash(c, "recipientDeleted");
  return c.redirect("/recipients", 303);
});

// ---------- S-11 宛先追加・編集 ----------

function renderForm(c: Context<AppEnv>, props: Parameters<typeof RecipientFormPage>[0]) {
  const s = screen("S-11");
  return renderPage(c, { title: s.name, nav: s.nav, children: <RecipientFormPage {...props} /> });
}

// 追加のプルダウンに出す利用者
async function candidates() {
  return selectableUsers(await listUsers(), await listRecipientsIncludingDeleted());
}

async function field(c: Context<AppEnv>, key: string): Promise<string> {
  const value = (await c.req.parseBody())[key];
  return typeof value === "string" ? value : "";
}

// 追加：利用者を選ぶ（未選択で開く。仮。Q-M25）
recipients.get("/recipients/new", async (c) =>
  renderForm(c, { mode: "new", action: "/recipients/new", users: await candidates(), userId: "" }),
);

// 追加の保存：表示名は利用者の名前。S-10 に戻り「宛先を登録しました」
recipients.post("/recipients/new", async (c) => {
  const userId = await field(c, "userId");
  const users = await candidates();
  const result = validateNewRecipient(userId, users);
  if (!result.ok) {
    return renderForm(c, { mode: "new", action: "/recipients/new", users, userId, errors: result.errors });
  }
  await createRecipient({ displayName: result.user.name, email: result.user.email }, c.var.currentUser.id, new Date());
  setFlash(c, "recipientCreated");
  return c.redirect("/recipients", 303);
});

// 編集：表示名だけを変える
recipients.get(`/recipients/${ID}/edit`, async (c) => {
  const id = Number(c.req.param("id"));
  const recipient = await findRecipient(id);
  if (!recipient) return c.notFound();
  return renderForm(c, { mode: "edit", action: `/recipients/${id}/edit`, displayName: recipient.displayName });
});

// 編集の保存：S-10 に戻り「宛先を更新しました」
recipients.post(`/recipients/${ID}/edit`, async (c) => {
  const id = Number(c.req.param("id"));
  if (!(await findRecipient(id))) return c.notFound();
  const input = await field(c, "displayName");
  const result = validateRecipientName(input);
  if (!result.ok) {
    // 入力画面にとどまり、入力した値を残す。保存しない
    return renderForm(c, { mode: "edit", action: `/recipients/${id}/edit`, displayName: input, errors: result.errors });
  }
  await updateRecipientName(id, result.displayName, c.var.currentUser.id, new Date());
  setFlash(c, "recipientUpdated");
  return c.redirect("/recipients", 303);
});
