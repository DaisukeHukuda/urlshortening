# url-shortener

Cloudflare Workers + D1 で動く自分・社内向けURL短縮サービス（Step 1: MVP）。

短縮リンクは誰でも踏める。作成・管理画面も認証なしで公開（誰でも作成・編集・削除可）。

## 機能

### Step 1: MVP
- 短縮URLの作成（ランダム6文字コード）・一覧
- 管理画面・管理APIは認証なし（公開）
- `GET /:code` の302リダイレクト
- 総クリック数カウント（`ctx.waitUntil()` で非同期計測。リダイレクト速度に影響なし）

### Step 2: 分析
- リダイレクトごとに `clicks` イベントを記録（国 `CF-IPCountry` / 流入元ホスト名 / デバイス・OS・ブラウザ）
- リンク別ダッシュボード（総数・日別時系列・国/流入元/デバイス/OS/ブラウザ内訳）。外部依存なしの自前グラフ

### Step 3: 便利機能
- カスタム短縮コード（英数・`-`・`_`、32文字まで、予約語除外）
- QRコード生成（ライブラリを自前ホスト、生成はクライアント側のみ）
- 有効期限・無効化（期限切れ/無効は 410 を返す）
- リンクの編集・削除（削除時は計測データも除去）

## 開発

```bash
npm install

# 初回のみ: 本番用D1を作成し、出力の database_id を wrangler.jsonc に記入
# （ローカル開発・テストだけなら不要。placeholder のままで動く）
# npx wrangler d1 create url_shortener

# ローカルD1にマイグレーション適用
npx wrangler d1 migrations apply url_shortener --local

npm run dev        # http://localhost:8787
npm test           # 全テスト（vitest + miniflare D1）
npm run typecheck  # tsc --noEmit
```

## デプロイ

```bash
npx wrangler d1 create url_shortener          # database_id を wrangler.jsonc に記入
npx wrangler d1 migrations apply url_shortener --remote
npm run deploy
```

## 構成

| パス | 役割 |
|------|------|
| `src/index.ts` | fetch エントリ・ルーティング（/api・/:code・静的アセット） |
| `src/api.ts` | `/api/links`（CRUD・PATCH・DELETE）・`/api/stats`（認証なし） |
| `src/links.ts` | links の作成/一覧/取得/更新/削除・URL/コード検証 |
| `src/redirect.ts` | リダイレクト・無効/期限切れ判定・クリック計測 |
| `src/stats.ts` | リンク別アクセス集計 |
| `src/ua.ts` | User-Agent 分類（デバイス/OS/ブラウザ） |
| `src/codegen.ts` | base62 短縮コード生成 |
| `migrations/` | 0001 links / 0002 clicks / 0003 expires_at・disabled |
| `public/` | 管理UI（静的アセット、QRライブラリは `public/vendor/`） |
