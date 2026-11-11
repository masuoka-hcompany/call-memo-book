// 宛先の画面（S-10 宛先一覧）

import { Hono } from "hono";
import { deleteRecipient, listRecipients } from "../repo/recipients.ts";
import { listUsers } from "../repo/users.ts";
import type { AppEnv } from "../types.ts";
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
