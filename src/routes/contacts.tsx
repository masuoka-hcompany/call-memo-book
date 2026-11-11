// 担当者の画面（S-08 担当者詳細、S-09 担当者登録・編集）

import { type Context, Hono } from "hono";
import { type ContactInput, validateContactInput } from "../domain/contact.ts";
import { findCompany } from "../repo/companies.ts";
import { createContact, deleteContact, findContact, updateContact } from "../repo/contacts.ts";
import { listContactSettings, saveContactSettings } from "../repo/settings.ts";
import { listUsers } from "../repo/users.ts";
import type { AppEnv } from "../types.ts";
import { ContactDetailPage } from "../views/ContactDetailPage.tsx";
import { ContactFormPage } from "../views/ContactFormPage.tsx";
import { screen } from "../views/screens.ts";
import { renderPage, setFlash } from "./page.tsx";
import { submittedSettingChanges } from "./settings-form.ts";

export const contacts = new Hono<AppEnv>();

const ID = ":id{[0-9]+}";

// ---------- S-09 担当者登録・編集 ----------

function renderForm(c: Context<AppEnv>, props: Parameters<typeof ContactFormPage>[0]) {
  const s = screen("S-09");
  return renderPage(c, { title: s.name, nav: s.nav, children: <ContactFormPage {...props} /> });
}

async function readInput(c: Context<AppEnv>): Promise<ContactInput> {
  const body = await c.req.parseBody();
  const text = (key: string) => (typeof body[key] === "string" ? (body[key] as string) : "");
  return { name: text("name"), kana: text("kana"), phone: text("phone"), memo: text("memo") };
}

const EMPTY: ContactInput = { name: "", kana: "", phone: "", memo: "" };

// 登録（S-06 の「担当者を追加」）：すべて空欄で開く。会社が削除済み・存在しなければ 404
contacts.get(`/companies/${ID}/contacts/new`, async (c) => {
  const companyId = Number(c.req.param("id"));
  if (!(await findCompany(companyId))) return c.notFound();
  return renderForm(c, { action: `/companies/${companyId}/contacts/new`, values: EMPTY });
});

// 登録の保存：エラーがなければ S-06 会社詳細に戻り「担当者を登録しました」
contacts.post(`/companies/${ID}/contacts/new`, async (c) => {
  const companyId = Number(c.req.param("id"));
  if (!(await findCompany(companyId))) return c.notFound();
  const input = await readInput(c);
  const result = validateContactInput(input);
  if (!result.ok) {
    // 入力画面にとどまり、入力した値を残す。保存しない
    return renderForm(c, { action: `/companies/${companyId}/contacts/new`, values: input, errors: result.errors });
  }
  await createContact(companyId, result.values, c.var.currentUser.id, new Date());
  setFlash(c, "contactCreated");
  return c.redirect(`/companies/${companyId}`, 303);
});

// 編集（S-08 の「編集」）：登録済みの値を入れて開く
contacts.get(`/contacts/${ID}/edit`, async (c) => {
  const id = Number(c.req.param("id"));
  const contact = await findContact(id);
  if (!contact) return c.notFound();
  return renderForm(c, {
    action: `/contacts/${id}/edit`,
    values: { name: contact.name, kana: contact.kana, phone: contact.phone, memo: contact.memo },
  });
});

// 編集の保存：エラーがなければ S-06 会社詳細（所属する会社）に戻り「担当者を更新しました」
contacts.post(`/contacts/${ID}/edit`, async (c) => {
  const id = Number(c.req.param("id"));
  const contact = await findContact(id);
  if (!contact) return c.notFound();
  const input = await readInput(c);
  const result = validateContactInput(input);
  if (!result.ok) {
    return renderForm(c, { action: `/contacts/${id}/edit`, values: input, errors: result.errors });
  }
  await updateContact(id, result.values, c.var.currentUser.id, new Date());
  setFlash(c, "contactUpdated");
  return c.redirect(`/companies/${contact.companyId}`, 303);
});

// ---------- S-08 担当者詳細 ----------

contacts.get(`/contacts/${ID}`, async (c) => {
  const id = Number(c.req.param("id"));
  const contact = await findContact(id);
  const company = contact && (await findCompany(contact.companyId));
  if (!contact || !company) return c.notFound();
  const s = screen("S-08");
  return renderPage(c, {
    title: s.name,
    nav: s.nav,
    children: (
      <ContactDetailPage
        contact={contact}
        company={company}
        settings={await listContactSettings(id)}
        users={await listUsers()}
      />
    ),
  });
});

// 取次可否（担当者単位）の保存：S-08 にとどまり「取次可否を更新しました」
contacts.post(`/contacts/${ID}/settings`, async (c) => {
  const id = Number(c.req.param("id"));
  if (!(await findContact(id))) return c.notFound();
  const changes = submittedSettingChanges(await c.req.parseBody(), await listContactSettings(id));
  await saveContactSettings(id, changes, c.var.currentUser.id, new Date());
  setFlash(c, "settingsUpdated");
  return c.redirect(`/contacts/${id}`, 303);
});

// 削除（確認ダイアログの「削除する」）：S-06 会社詳細（所属する会社）に戻り「担当者を削除しました」
contacts.post(`/contacts/${ID}/delete`, async (c) => {
  const id = Number(c.req.param("id"));
  const deleted = await deleteContact(id, c.var.currentUser.id, new Date());
  if (!deleted) return c.notFound();
  setFlash(c, "contactDeleted");
  return c.redirect(`/companies/${deleted.companyId}`, 303);
});
