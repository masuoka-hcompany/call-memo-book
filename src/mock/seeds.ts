// 固定データ（モック専用）：共通の前提・デモデータ・AC ごとのシード
//
// - 名前・会社名・電話番号はすべて架空。メールアドレスは仮の値 @example.com（docs/questions.md Q-M05）
// - ID は固定にして、毎回同じ画面にリダイレクトされるようにする
// - 呼ぶたびに新しいオブジェクトを返す（store を書き換えても元の定義は変わらない）

import { MEMO_PURPOSES, type MemoPurpose } from "../domain/memo.ts";
import type { SettingValue } from "../domain/setting.ts";
import { displayName } from "../domain/text.ts";
import type { Company, CompanySetting, Contact, ContactSetting, Id, Memo, Recipient, User } from "../repo/types.ts";
import type { StoreData } from "./store.ts";

// ---------- 共通の前提（仕様書 10.2） ----------

export const USER_KIKUCHI: User = { id: 1, email: "kikuchi@example.com", name: "菊地" };
export const USER_MASUOKA: User = { id: 2, email: "masuoka@example.com", name: "益岡" };
export const USER_KIMURA: User = { id: 3, email: "kimura@example.com", name: "木村" };

// ログインユーザー切替で指定がないときの利用者（共通の前提「利用者「菊地」でログインしている」）
export const DEFAULT_LOGIN_EMAIL = USER_KIKUCHI.email;

function baseUsers(): User[] {
  return [USER_KIKUCHI, USER_MASUOKA, USER_KIMURA].map((u) => ({ ...u }));
}

// 宛先「菊地」「社長」。「菊地」は利用者「菊地」と同じメールアドレス。「木村」は宛先ではない。
// 最初の宛先はエンジニアが DB に直接登録する（仕様書 F-09）ため、更新者・更新日時はない。
const RECIPIENT_KIKUCHI_ID = 1;
const RECIPIENT_SHACHO_ID = 2;

function baseRecipients(): Recipient[] {
  return [
    {
      id: RECIPIENT_KIKUCHI_ID,
      displayName: "菊地",
      email: USER_KIKUCHI.email,
      deleted: false,
      updatedBy: null,
      updatedAt: null,
    },
    {
      id: RECIPIENT_SHACHO_ID,
      displayName: "社長",
      email: "shacho@example.com",
      deleted: false,
      updatedBy: null,
      updatedAt: null,
    },
  ];
}

// 共通の前提：利用者3人、宛先2人。会社・担当者・取次メモは0件
export function buildDefaultData(): StoreData {
  return {
    users: baseUsers(),
    recipients: baseRecipients(),
    companies: [],
    contacts: [],
    companySettings: [],
    contactSettings: [],
    memos: [],
  };
}

// ---------- デモデータ（レビュー会で触る用） ----------
// 見どころ：同じ会社名の別の会社（東和建設×2）、会社名が空の会社、担当者0人の会社、
// つなぐ／つながない／未設定の混在、会社と担当者で取次可否が違う相手、未対処・対処済みの混在、
// 2ページ目が出る件数（表示される取次メモが50件を超える）、削除済みの会社・担当者・取次メモ

// 日本時間の日時を UTC の ISO 文字列にする
function jst(year: number, month: number, day: number, hour: number, minute: number): string {
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute)).toISOString();
}

const SEEDED_AT = jst(2026, 11, 2, 10, 0);

type CompanyDef = [id: Id, name: string, kana: string, memo: string, deleted?: boolean];
const DEMO_COMPANIES: CompanyDef[] = [
  [1, "東和建設", "とうわけんせつ", "本社（東京）"],
  [2, "東和建設", "とうわけんせつ", "大阪の別会社。東京の東和建設とは無関係"],
  [3, "青葉設備", "あおばせつび", ""],
  [4, "北斗電工", "ほくとでんこう", ""],
  [5, "みなと工務店", "みなとこうむてん", ""],
  [6, "桜井塗装", "さくらいとそう", "営業電話が多い"],
  [7, "", "やまびこでんき", "会社名が不明。よみがなだけ登録"],
  [8, "中央改装", "ちゅうおうかいそう", "担当者はまだ登録していない"],
  [9, "丸山商事", "まるやましょうじ", ""],
  [10, "光陽産業", "こうようさんぎょう", ""],
  [11, "大河内住宅", "おおこうちじゅうたく", "取引終了", true],
];

type ContactDef = [id: Id, companyId: Id, name: string, kana: string, phone: string, deleted?: boolean];
const DEMO_CONTACTS: ContactDef[] = [
  [1, 1, "田中　一郎", "たなか　いちろう", "0311112222"],
  [2, 1, "鈴木　花子", "すずき　はなこ", "09011112222"],
  [3, 2, "佐々木　健", "ささき　けん", "0661113333"],
  [4, 3, "高橋　誠", "たかはし　まこと", "0452223333"],
  [5, 3, "伊藤　美咲", "いとう　みさき", "08022223333"],
  [6, 4, "渡辺　大輔", "わたなべ　だいすけ", "0113334444"],
  [7, 5, "山本　裕子", "やまもと　ゆうこ", "0524445555"],
  [8, 5, "中村　亮", "なかむら　りょう", "07044445555"],
  [9, 6, "小林　直樹", "こばやし　なおき", "0925556666"],
  [10, 7, "", "かとう　しんじ", "0226667777"],
  [11, 9, "吉田　恵", "よしだ　めぐみ", "0337778888"],
  [12, 9, "山田　浩二", "やまだ　こうじ", "0337778889"],
  [13, 9, "", "まつもと", "09077778888"],
  [14, 10, "井上　拓也", "いのうえ　たくや", "0488889999"],
  [15, 4, "木下　修", "きのした　おさむ", "0113334445", true],
  [16, 11, "林　正", "はやし　ただし", "0759990000", true],
];

// [会社または担当者の ID, 宛先「菊地」, 宛先「社長」]。null は行がない（未設定）
type SettingDef = [id: Id, kikuchi: SettingValue | null, shacho: SettingValue | null];
const DEMO_COMPANY_SETTINGS: SettingDef[] = [
  [1, "decline", "decline"],
  [2, "connect", null],
  [3, "connect", "connect"],
  [4, "decline", "unset"],
  [6, "connect", "decline"],
  [7, null, "decline"],
  [8, "decline", "connect"],
  [9, "connect", null],
  [10, null, "connect"],
];
// 会社と担当者で取次可否が違う相手を含める
const DEMO_CONTACT_SETTINGS: SettingDef[] = [
  [2, "connect", null], // 東和建設（東京）は「つながない」だが、鈴木さんは菊地に「つなぐ」
  [4, null, "decline"], // 青葉設備は社長に「つなぐ」だが、高橋さんは「つながない」
  [6, "connect", "connect"],
  [8, "decline", null],
  [10, "connect", null],
  [11, "decline", "connect"],
];

function settingRows<T>(defs: SettingDef[], make: (id: Id, recipientId: Id, value: SettingValue, i: number) => T): T[] {
  const rows: T[] = [];
  defs.forEach(([id, kikuchi, shacho], i) => {
    if (kikuchi !== null) rows.push(make(id, RECIPIENT_KIKUCHI_ID, kikuchi, i));
    if (shacho !== null) rows.push(make(id, RECIPIENT_SHACHO_ID, shacho, i));
  });
  return rows;
}

const USER_IDS = [USER_KIKUCHI.id, USER_MASUOKA.id, USER_KIMURA.id] as const;
function userAt(i: number): Id {
  return USER_IDS[i % USER_IDS.length] as Id;
}

// 取次メモの相手：登録済みの担当者（ID）か、未登録の相手
type Caller = Id | { companyName: string; personName: string; phone: string };
const DEMO_CALLERS: Caller[] = [
  1,
  2,
  4,
  { companyName: "西新宿クリニック", personName: "岡田", phone: "0355550101" },
  6,
  9,
  3,
  11,
  { companyName: "ひまわり保育園", personName: "", phone: "" },
  7,
  10,
  13,
  5,
  { companyName: "大和運輸", personName: "石井", phone: "0120555777" },
];

const DEMO_MESSAGES = [
  "見積書を送付しました",
  "来週の打ち合わせの件で連絡がほしい",
  "請求書の宛名について確認したい",
  "",
  "現場の日程を変更したい",
  "資料を受け取ったとのこと",
  "新しい商品の案内をしたい",
];
const DEMO_NOTES = ["", "15時以降なら在席とのこと", "", "急ぎではないとのこと", ""];

const DEMO_MEMO_COUNT = 60;

function buildDemoMemos(companies: Company[], contacts: Contact[]): Memo[] {
  const memos: Memo[] = [];
  for (let i = 0; i < DEMO_MEMO_COUNT; i++) {
    // 新しい順に、1日8件（9時〜16時台）ずつさかのぼる
    const day = 10 - Math.floor(i / 8);
    const hour = 16 - (i % 8);
    const minute = (i * 13) % 60;
    const receivedAt = jst(2026, 11, day, hour, minute);
    const createdAt = jst(2026, 11, day, hour, minute + 3);

    const caller = DEMO_CALLERS[i % DEMO_CALLERS.length] as Caller;
    let companyName: string;
    let personName: string;
    let phone: string;
    let companyId: Id | null = null;
    let contactId: Id | null = null;
    if (typeof caller === "number") {
      const contact = contacts.find((c) => c.id === caller) as Contact;
      const company = companies.find((c) => c.id === contact.companyId) as Company;
      companyName = displayName(company.name, company.kana);
      personName = displayName(contact.name, contact.kana);
      phone = contact.phone;
      companyId = company.id;
      contactId = contact.id;
    } else {
      ({ companyName, personName, phone } = caller);
    }

    let purpose: MemoPurpose = MEMO_PURPOSES[i % MEMO_PURPOSES.length] as MemoPurpose;
    // 「折り返し希望」は電話番号が必須
    if (purpose === "callback" && phone === "") purpose = "message";

    // 新しい12件は未対処が多く、それより古いものは対処済みが多い
    const open = i < 12 ? i % 3 !== 1 : i % 7 === 0;
    const recipientId = i % 3 === 2 ? RECIPIENT_SHACHO_ID : RECIPIENT_KIKUCHI_ID;
    const createdBy = userAt(i);
    // 社長宛ては、益岡が代わりに対処済みにする
    const doneBy = open ? null : recipientId === RECIPIENT_KIKUCHI_ID ? USER_KIKUCHI.id : USER_MASUOKA.id;

    memos.push({
      id: i + 1,
      recipientId,
      receivedAt,
      companyName,
      personName,
      phone,
      companyId,
      contactId,
      purpose,
      message: DEMO_MESSAGES[i % DEMO_MESSAGES.length] as string,
      note: DEMO_NOTES[i % DEMO_NOTES.length] as string,
      status: open ? "open" : "done",
      doneBy,
      doneAt: open ? null : jst(2026, 11, day, hour + 2, minute),
      createdBy,
      createdAt,
      // 最も古い1件は削除済み（論理削除）
      deleted: i === DEMO_MEMO_COUNT - 1,
      updatedBy: createdBy,
      updatedAt: createdAt,
    });
  }
  return memos;
}

export function buildDemoData(): StoreData {
  const companies: Company[] = DEMO_COMPANIES.map(([id, name, kana, memo, deleted], i) => ({
    id,
    name,
    kana,
    memo,
    deleted: deleted ?? false,
    updatedBy: userAt(i),
    updatedAt: SEEDED_AT,
  }));
  const contacts: Contact[] = DEMO_CONTACTS.map(([id, companyId, name, kana, phone, deleted], i) => ({
    id,
    companyId,
    name,
    kana,
    phone,
    memo: "",
    deleted: deleted ?? false,
    updatedBy: userAt(i),
    updatedAt: SEEDED_AT,
  }));
  const companySettings = settingRows<CompanySetting>(DEMO_COMPANY_SETTINGS, (companyId, recipientId, value, i) => ({
    companyId,
    recipientId,
    value,
    updatedBy: userAt(i),
    updatedAt: SEEDED_AT,
  }));
  const contactSettings = settingRows<ContactSetting>(DEMO_CONTACT_SETTINGS, (contactId, recipientId, value, i) => ({
    contactId,
    recipientId,
    value,
    updatedBy: userAt(i + 1),
    updatedAt: SEEDED_AT,
  }));
  return {
    users: baseUsers(),
    recipients: baseRecipients(),
    companies,
    contacts,
    companySettings,
    contactSettings,
    memos: buildDemoMemos(companies, contacts),
  };
}

// ---------- AC ごとのシード（Given の状態） ----------
// 共通の前提に、Given に書かれたものだけを足す。ID は固定。
// Given に書かれていない更新者・更新日時・メモは、更新者「菊地」・SEEDED_AT・空とする。

function acCompany(id: Id, name: string, kana: string): Company {
  return { id, name, kana, memo: "", deleted: false, updatedBy: USER_KIKUCHI.id, updatedAt: SEEDED_AT };
}

function acContact(id: Id, companyId: Id, name: string, kana: string, phone: string): Contact {
  return {
    id,
    companyId,
    name,
    kana,
    phone,
    memo: "",
    deleted: false,
    updatedBy: USER_KIKUCHI.id,
    updatedAt: SEEDED_AT,
  };
}

function withDefault(add: Partial<StoreData>): () => StoreData {
  return () => ({ ...buildDefaultData(), ...structuredClone(add) });
}

// 会社一覧（S-05）を開いた状態の AC
const AC_SEEDS_S05: Seed[] = [
  {
    name: "AC-21",
    description: "AC-21 会社を登録する：会社0件、S-05 会社一覧を開く",
    build: buildDefaultData,
    loginEmail: USER_KIKUCHI.email,
    redirect: "/companies",
  },
  {
    name: "AC-22",
    description: "AC-22 同じ会社名の会社を登録する：会社「マイナビ」1件、S-05 会社一覧を開く",
    build: withDefault({ companies: [acCompany(1, "マイナビ", "まいなび")] }),
    loginEmail: USER_KIKUCHI.email,
    redirect: "/companies",
  },
  {
    name: "AC-57",
    description: "AC-57 会社一覧で検索する：会社「マイナビ」「ミイダス」、S-05 会社一覧を開く",
    build: withDefault({
      companies: [acCompany(1, "マイナビ", "まいなび"), acCompany(2, "ミイダス", "みいだす")],
    }),
    loginEmail: USER_KIKUCHI.email,
    redirect: "/companies",
  },
  {
    // Given に画面の指定はない。When の「S-05 会社一覧を開く」の画面にリダイレクトする。
    // 担当者2人の名前・電話番号は Given にないため、AC-45 と同じ「原田」「佐藤」とする。
    name: "AC-58",
    description:
      "AC-58 会社一覧の並び順と担当者数：会社「ミイダス」（担当者0人）、「マイナビ」（担当者2人）の順に登録、S-05 会社一覧を開く",
    build: withDefault({
      companies: [acCompany(1, "ミイダス", "みいだす"), acCompany(2, "マイナビ", "まいなび")],
      contacts: [acContact(1, 2, "原田", "はらだ", "0312345678"), acContact(2, 2, "佐藤", "さとう", "0398765432")],
    }),
    loginEmail: USER_KIKUCHI.email,
    redirect: "/companies",
  },
  {
    name: "AC-68",
    description: "AC-68 会社名を空にしてよみがなだけで登録できる：会社0件、S-05 会社一覧を開く",
    build: buildDefaultData,
    loginEmail: USER_KIKUCHI.email,
    redirect: "/companies",
  },
];

// ---------- シードの一覧（/__seed） ----------

export type Seed = {
  // /__seed/{name}
  name: string;
  // /__seed の一覧に出す説明
  description: string;
  build: () => StoreData;
  // 切り替えるログインユーザー（メールアドレス）
  loginEmail: string;
  // データを入れたあとに開く画面
  redirect: string;
};

export const SEEDS: Seed[] = [
  {
    name: "default",
    description:
      "共通の前提（仕様書 10.2）：利用者「菊地」「益岡」「木村」、宛先「菊地」「社長」。会社・担当者・取次メモは0件",
    build: buildDefaultData,
    loginEmail: DEFAULT_LOGIN_EMAIL,
    redirect: "/",
  },
  {
    name: "demo",
    description: "デモデータ：会社10社（ほかに削除済み1社）、取次メモ60件（うち削除済み1件）。起動時のデータと同じ",
    build: buildDemoData,
    loginEmail: DEFAULT_LOGIN_EMAIL,
    redirect: "/",
  },
  // AC ごとのシード（/__seed/AC-xx）。その AC の画面を作るときに足す
  ...AC_SEEDS_S05,
];

export function findSeed(name: string): Seed | undefined {
  return SEEDS.find((s) => s.name === name);
}
