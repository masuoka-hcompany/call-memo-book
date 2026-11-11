// 取次メモの画面（S-02 取次メモ一覧、S-04 取次メモ作成・編集）

import { type Context, Hono } from "hono";
import { toJstDateTimeLocal } from "../domain/datetime.ts";
import { MEMO_FIELD_LABELS, type MemoField, type MemoInput, validateMemoInput } from "../domain/memo.ts";
import {
  EMPTY_MEMO_LIST_QUERY,
  filterMemos,
  type MemoListQuery,
  paginate,
  parseMemoFilter,
} from "../domain/memo-list.ts";
import { displayName } from "../domain/text.ts";
import { findCompany } from "../repo/companies.ts";
import { findContact } from "../repo/contacts.ts";
import { createMemo, findMemo, listMemos, updateMemo } from "../repo/memos.ts";
import { listRecipients, listRecipientsIncludingDeleted } from "../repo/recipients.ts";
import { listUsers } from "../repo/users.ts";
import type { AppEnv } from "../types.ts";
import { MemoFormPage } from "../views/MemoFormPage.tsx";
import { MemoListPage } from "../views/MemoListPage.tsx";
import { screen } from "../views/screens.ts";
import { renderPage, setFlash } from "./page.tsx";

export const memos = new Hono<AppEnv>();

const ID = ":id{[0-9]+}";

type Link = { companyId: number | null; contactId: number | null };
const NO_LINK: Link = { companyId: null, contactId: null };

const EMPTY: Omit<MemoInput, "receivedAt"> = {
  recipientId: "",
  companyName: "",
  personName: "",
  phone: "",
  purpose: "",
  message: "",
  note: "",
};

async function renderForm(c: Context<AppEnv>, props: Omit<Parameters<typeof MemoFormPage>[0], "recipients">) {
  const s = screen("S-04");
  return renderPage(c, {
    title: s.name,
    nav: s.nav,
    children: <MemoFormPage {...props} recipients={await listRecipients()} />,
  });
}

async function readBody(c: Context<AppEnv>) {
  const body = await c.req.parseBody();
  const text = (key: string) => (typeof body[key] === "string" ? (body[key] as string) : "");
  const input = Object.fromEntries(Object.keys(MEMO_FIELD_LABELS).map((k) => [k, text(k)])) as MemoInput;
  return { input, companyId: text("companyId"), contactId: text("contactId") };
}

// S-01 で選んだ相手（?contact=・?company=）。削除されたもの・存在しないものは紐づけない
async function resolveLink(contactId: string, companyId: string): Promise<Link> {
  if (contactId !== "") {
    const contact = await findContact(Number(contactId));
    const company = contact && (await findCompany(contact.companyId));
    return contact && company ? { companyId: company.id, contactId: contact.id } : NO_LINK;
  }
  if (companyId !== "") {
    const company = await findCompany(Number(companyId));
    return company ? { companyId: company.id, contactId: null } : NO_LINK;
  }
  return NO_LINK;
}

// ---------- 作成 ----------

// 作成：受電日時は開いた日時（日本時間・分単位）。S-01 で相手を選んでいれば、会社名・氏名・電話番号を入れる
// （名前が空の会社・担当者は、よみがなを入れる。F-02）
memos.get("/memos/new", async (c) => {
  const link = await resolveLink(c.req.query("contact") ?? "", c.req.query("company") ?? "");
  const values: MemoInput = { ...EMPTY, receivedAt: toJstDateTimeLocal(new Date()) };
  if (link.companyId !== null) {
    const company = await findCompany(link.companyId);
    if (company) values.companyName = displayName(company.name, company.kana);
  }
  if (link.contactId !== null) {
    const contact = await findContact(link.contactId);
    if (contact) {
      values.personName = displayName(contact.name, contact.kana);
      values.phone = contact.phone;
    }
  }
  return renderForm(c, { action: "/memos/new", values, link });
});

// 作成の保存：S-02 取次メモ一覧に戻り「取次メモを登録しました」
memos.post("/memos/new", async (c) => {
  const { input, companyId, contactId } = await readBody(c);
  const link = await resolveLink(contactId, companyId);
  const recipientIds = (await listRecipients()).map((r) => r.id);
  const result = validateMemoInput(input, recipientIds);
  if (!result.ok) {
    // 作成画面にとどまり、入力した値を残す。保存しない
    return renderForm(c, { action: "/memos/new", values: result.input, link, errors: result.errors });
  }
  await createMemo(result.values, link, c.var.currentUser.id, new Date());
  setFlash(c, "memoCreated");
  return c.redirect("/memos", 303);
});

// ---------- 編集 ----------

// 編集：登録済みの値で開く
memos.get(`/memos/${ID}/edit`, async (c) => {
  const id = Number(c.req.param("id"));
  const memo = await findMemo(id);
  if (!memo) return c.notFound();
  const values: Record<MemoField, string> = {
    recipientId: String(memo.recipientId),
    receivedAt: toJstDateTimeLocal(memo.receivedAt),
    companyName: memo.companyName,
    personName: memo.personName,
    phone: memo.phone,
    purpose: memo.purpose,
    message: memo.message,
    note: memo.note,
  };
  return renderForm(c, { action: `/memos/${id}/edit`, values });
});

// 編集の保存：S-03 取次メモ詳細に戻り「取次メモを更新しました」。作成者は変えない
memos.post(`/memos/${ID}/edit`, async (c) => {
  const id = Number(c.req.param("id"));
  if (!(await findMemo(id))) return c.notFound();
  const { input } = await readBody(c);
  const recipientIds = (await listRecipients()).map((r) => r.id);
  const result = validateMemoInput(input, recipientIds);
  if (!result.ok) {
    return renderForm(c, { action: `/memos/${id}/edit`, values: result.input, errors: result.errors });
  }
  await updateMemo(id, result.values, c.var.currentUser.id, new Date());
  setFlash(c, "memoUpdated");
  return c.redirect(`/memos/${id}`, 303);
});

// ---------- 一覧 ----------

// S-02 取次メモ一覧：?recipient=（""・me・宛先の ID）&status=（""・open・done）&from=&to=（日本時間の日付）&q=&page=
// 開いたときは全員宛て・全状態（F-03）
memos.get("/memos", async (c) => {
  const query = Object.fromEntries(
    Object.keys(EMPTY_MEMO_LIST_QUERY).map((k) => [k, c.req.query(k) ?? ""]),
  ) as MemoListQuery;
  const all = await listMemos();
  const allRecipients = await listRecipientsIncludingDeleted();
  // 「自分宛て」：ログイン中の利用者と同じメールアドレスの宛先（F-09）
  const me = c.var.currentUser;
  const myRecipientIds = allRecipients.filter((r) => r.email === me.email).map((r) => r.id);
  const result = paginate(filterMemos(all, parseMemoFilter(query), myRecipientIds), query.page);
  const s = screen("S-02");
  return renderPage(c, {
    title: s.name,
    nav: s.nav,
    children: (
      <MemoListPage
        query={query}
        recipientOptions={await listRecipients()}
        allRecipients={allRecipients}
        users={await listUsers()}
        noMemos={all.length === 0}
        result={result}
      />
    ),
  });
});
