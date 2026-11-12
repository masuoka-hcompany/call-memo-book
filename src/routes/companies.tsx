// 会社の画面（S-05 会社一覧、S-06 会社詳細、S-07 会社登録・編集）

import { type Context, Hono } from "hono";
import { type CompanyInput, validateCompanyInput } from "../domain/company.ts";
import { createCompany, deleteCompany, findCompany, listCompanies, updateCompany } from "../repo/companies.ts";
import { listContactsByCompany } from "../repo/contacts.ts";
import { listCompanySettings, saveCompanySettings } from "../repo/settings.ts";
import { listUsers } from "../repo/users.ts";
import type { AppEnv } from "../types.ts";
import { CompanyDetailPage } from "../views/CompanyDetailPage.tsx";
import { CompanyFormPage } from "../views/CompanyFormPage.tsx";
import { CompanyListPage } from "../views/CompanyListPage.tsx";
import { screen } from "../views/screens.ts";
import { renderPage, setFlash } from "./page.tsx";
import { submittedSettingChanges } from "./settings-form.ts";

export const companies = new Hono<AppEnv>();

const ID = ":id{[0-9]+}";

// S-05 会社一覧（?q= で検索）
companies.get("/companies", async (c) => {
  const keyword = c.req.query("q") ?? "";
  const s = screen("S-05");
  return renderPage(c, {
    title: s.name,
    nav: s.nav,
    children: <CompanyListPage keyword={keyword} companies={await listCompanies(keyword)} />,
  });
});

// ---------- S-07 会社登録・編集 ----------

function renderForm(c: Context<AppEnv>, props: Parameters<typeof CompanyFormPage>[0]) {
  const s = screen("S-07");
  return renderPage(c, { title: s.name, nav: s.nav, children: <CompanyFormPage {...props} /> });
}

async function readInput(c: Context<AppEnv>): Promise<CompanyInput> {
  const body = await c.req.parseBody();
  const text = (key: string) => (typeof body[key] === "string" ? (body[key] as string) : "");
  return { name: text("name"), kana: text("kana"), memo: text("memo") };
}

// 登録：すべて空欄で開く
companies.get("/companies/new", (c) =>
  renderForm(c, { action: "/companies/new", values: { name: "", kana: "", memo: "" } }),
);

// 登録の保存：エラーがなければ S-06 会社詳細に移り「会社を登録しました」
companies.post("/companies/new", async (c) => {
  const input = await readInput(c);
  const result = validateCompanyInput(input);
  if (!result.ok) {
    // 入力画面にとどまり、入力した値を残す。保存しない
    return renderForm(c, { action: "/companies/new", values: input, errors: result.errors });
  }
  const company = await createCompany(result.values, c.var.currentUser.id, new Date());
  setFlash(c, "companyCreated");
  return c.redirect(`/companies/${company.id}`, 303);
});

// 編集：登録済みの値を入れて開く
companies.get(`/companies/${ID}/edit`, async (c) => {
  const id = Number(c.req.param("id"));
  const company = await findCompany(id);
  if (!company) return c.notFound();
  return renderForm(c, {
    action: `/companies/${id}/edit`,
    values: { name: company.name, kana: company.kana, memo: company.memo },
  });
});

// 編集の保存：エラーがなければ S-06 会社詳細に移り「会社を更新しました」
companies.post(`/companies/${ID}/edit`, async (c) => {
  const id = Number(c.req.param("id"));
  if (!(await findCompany(id))) return c.notFound();
  const input = await readInput(c);
  const result = validateCompanyInput(input);
  if (!result.ok) {
    return renderForm(c, { action: `/companies/${id}/edit`, values: input, errors: result.errors });
  }
  await updateCompany(id, result.values, c.var.currentUser.id, new Date());
  setFlash(c, "companyUpdated");
  return c.redirect(`/companies/${id}`, 303);
});

// ---------- S-06 会社詳細 ----------

companies.get(`/companies/${ID}`, async (c) => {
  const id = Number(c.req.param("id"));
  const company = await findCompany(id);
  if (!company) return c.notFound();
  const s = screen("S-06");
  return renderPage(c, {
    title: s.name,
    nav: s.nav,
    children: (
      <CompanyDetailPage
        company={company}
        contacts={await listContactsByCompany(id)}
        settings={await listCompanySettings(id)}
        users={await listUsers()}
      />
    ),
  });
});

// 取次可否（会社単位）の保存：S-06 にとどまり「取次可否を更新しました」
companies.post(`/companies/${ID}/settings`, async (c) => {
  const id = Number(c.req.param("id"));
  if (!(await findCompany(id))) return c.notFound();
  const changes = submittedSettingChanges(await c.req.parseBody(), await listCompanySettings(id));
  await saveCompanySettings(id, changes, c.var.currentUser.id, new Date());
  setFlash(c, "settingsUpdated");
  return c.redirect(`/companies/${id}`, 303);
});

// 削除（確認ダイアログの「削除する」）：S-05 会社一覧に戻り「会社を削除しました」
companies.post(`/companies/${ID}/delete`, async (c) => {
  const id = Number(c.req.param("id"));
  if (!(await deleteCompany(id, c.var.currentUser.id, new Date()))) return c.notFound();
  setFlash(c, "companyDeleted");
  return c.redirect("/companies", 303);
});
