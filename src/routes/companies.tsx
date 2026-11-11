// 会社の画面（S-05 会社一覧。S-06・S-07 はその画面を作るときに足す）

import { Hono } from "hono";
import { listCompanies } from "../repo/companies.ts";
import type { AppEnv } from "../types.ts";
import { CompanyListPage } from "../views/CompanyListPage.tsx";
import { screen } from "../views/screens.ts";
import { renderPage } from "./page.tsx";

export const companies = new Hono<AppEnv>();

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
