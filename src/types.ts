// Hono アプリ全体で使う型定義

export type AppEnv = {
  // wrangler.jsonc から渡される値（型は `wrangler types` が生成する Env）
  Bindings: Env;
  Variables: {
    // Access で認証されたユーザーのメールアドレス
    userEmail: string;
  };
};
