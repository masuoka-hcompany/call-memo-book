// 利用者のデータアクセス（後で D1 に差し替える。D1 と同じく Promise を返す）
// 利用者を画面から編集・削除することは STEP1 では行わない（仕様書 F-10）ので、読み取りだけ。

import { getStore } from "../mock/store.ts";
import type { Id, User } from "./types.ts";

export async function listUsers(): Promise<User[]> {
  return getStore().users.map((u) => ({ ...u }));
}

export async function findUserById(id: Id): Promise<User | null> {
  const user = getStore().users.find((u) => u.id === id);
  return user ? { ...user } : null;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const user = getStore().users.find((u) => u.email === email);
  return user ? { ...user } : null;
}
