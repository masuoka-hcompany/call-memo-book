import { describe, expect, it } from "vitest";
import { findOrCreateUser, findUserByEmail } from "../../src/repo/users.ts";
import { db, uniqueEmail } from "../fixtures.ts";

function sequence(): Promise<number | null> {
  return db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'users'").first<number>("seq");
}

describe("findOrCreateUser", () => {
  it("初めてのメールアドレスなら、利用者を登録して返す", async () => {
    const email = uniqueEmail();
    expect(await findUserByEmail(db, email)).toBeNull();

    const user = await findOrCreateUser(db, email, "菊地");
    expect(user).toEqual({ id: expect.any(Number), email, name: "菊地" });
    expect(await findUserByEmail(db, email)).toEqual(user);
  });

  it("登録済みなら、同じ利用者を返す。名前は上書きせず、ID の連番も進めない", async () => {
    const email = uniqueEmail();
    const first = await findOrCreateUser(db, email, "菊地");
    const before = await sequence();

    const second = await findOrCreateUser(db, email, "別の名前");
    expect(second).toEqual(first);
    expect(await sequence()).toBe(before);
  });

  it("大文字・小文字が違うメールアドレスは、同じ利用者とみなす", async () => {
    const email = uniqueEmail("Kikuchi");
    const first = await findOrCreateUser(db, email, "菊地");
    expect(await findOrCreateUser(db, email.toUpperCase(), "菊地")).toEqual(first);
  });
});
