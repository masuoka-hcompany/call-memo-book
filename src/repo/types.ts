// エンティティの型（仕様書 8.1 の7種類）
// DB の表記は未定（仕様書 Q-06）。モックではこの形でメモリに持ち、後で D1 に差し替える。

import type { MemoPurpose, MemoStatus } from "../domain/memo.ts";
import type { SettingValue } from "../domain/setting.ts";

export type Id = number;
// 日時は UTC の ISO 8601 文字列で持つ。表示・入力のときに日本時間へ変換する（src/domain/datetime.ts）
export type Timestamp = string;

// 利用者
export type User = {
  id: Id;
  email: string;
  name: string;
};

// 宛先。利用者とはメールアドレスで照合する
export type Recipient = {
  id: Id;
  displayName: string;
  email: string;
  deleted: boolean;
  // エンジニアが DB に直接登録した宛先は、更新者がいない
  updatedBy: Id | null;
  updatedAt: Timestamp | null;
};

// 会社
export type Company = {
  id: Id;
  name: string;
  kana: string;
  memo: string;
  deleted: boolean;
  updatedBy: Id;
  updatedAt: Timestamp;
};

// 担当者（所属する会社は変えない）
export type Contact = {
  id: Id;
  companyId: Id;
  name: string;
  kana: string;
  phone: string;
  memo: string;
  deleted: boolean;
  updatedBy: Id;
  updatedAt: Timestamp;
};

// 取次可否（会社単位）。会社×宛先で1件。行がなければ「未設定」
export type CompanySetting = {
  companyId: Id;
  recipientId: Id;
  value: SettingValue;
  updatedBy: Id;
  updatedAt: Timestamp;
};

// 取次可否（担当者単位）。担当者×宛先で1件。行がなければ「未設定」
export type ContactSetting = {
  contactId: Id;
  recipientId: Id;
  value: SettingValue;
  updatedBy: Id;
  updatedAt: Timestamp;
};

// 取次メモ。会社名・氏名・電話番号は作成時の値を持つ
export type Memo = {
  id: Id;
  recipientId: Id;
  receivedAt: Timestamp;
  companyName: string;
  personName: string;
  phone: string;
  companyId: Id | null;
  contactId: Id | null;
  purpose: MemoPurpose;
  message: string;
  note: string;
  status: MemoStatus;
  doneBy: Id | null;
  doneAt: Timestamp | null;
  createdBy: Id;
  createdAt: Timestamp;
  deleted: boolean;
  updatedBy: Id;
  updatedAt: Timestamp;
};
