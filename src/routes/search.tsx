// 相手検索の画面（S-01。トップ画面）
// ?q= で検索し、?contact=（担当者の行）または ?company=（会社だけの行）で相手を選ぶ。

import { Hono } from "hono";
import { shouldSearch } from "../domain/search.ts";
import { resolveSetting } from "../domain/setting.ts";
import { type Party, searchParties } from "../repo/search.ts";
import { listCompanySettings, listContactSettings } from "../repo/settings.ts";
import type { AppEnv } from "../types.ts";
import { type PartySetting, SearchPage } from "../views/SearchPage.tsx";
import { screen } from "../views/screens.ts";
import { renderPage } from "./page.tsx";

export const search = new Hono<AppEnv>();

// 選んだ相手の、宛先ごとの取次可否（削除された宛先は出さない）
async function partySettings(party: Party): Promise<PartySetting[]> {
  const companySettings = await listCompanySettings(party.company.id);
  const contactSettings = party.contact ? await listContactSettings(party.contact.id) : null;
  return companySettings.map((cs) => {
    const contact = contactSettings?.find((s) => s.recipient.id === cs.recipient.id)?.value ?? null;
    return { recipient: cs.recipient, company: cs.value, contact, resolved: resolveSetting(contact, cs.value) };
  });
}

// 「取次メモを作成」の行き先。相手を選んでいれば渡す（S-04 で会社名・氏名・電話番号を自動で入れる）
function createMemoHref(selected: Party | null): string {
  if (!selected) return "/memos/new";
  return selected.contact ? `/memos/new?contact=${selected.contact.id}` : `/memos/new?company=${selected.company.id}`;
}

search.get("/", async (c) => {
  const keyword = c.req.query("q") ?? "";
  const searched = shouldSearch(keyword);
  const rows = await searchParties(keyword);
  // 選んだ相手は、いまの検索結果の中にあるものだけ（削除されたもの・結果にないものは選ばない）
  const contactQ = c.req.query("contact");
  const companyQ = c.req.query("company");
  const selected =
    rows.find((r) =>
      contactQ !== undefined
        ? r.contact?.id === Number(contactQ)
        : companyQ !== undefined && r.contact === null && r.company.id === Number(companyQ),
    ) ?? null;
  const s = screen("S-01");
  return renderPage(c, {
    title: s.name,
    nav: s.nav,
    children: (
      <SearchPage
        keyword={keyword}
        searched={searched}
        rows={rows}
        selected={selected}
        settings={selected ? await partySettings(selected) : []}
        createMemoHref={createMemoHref(selected)}
      />
    ),
  });
});
