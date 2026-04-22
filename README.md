# Docchi

Docchi のMVP向けスキャフォールドです。匿名2択投票を Cloudflare Workers + D1 で実装し、Expo Go で確認できる React Native クライアントを用意しています。

## ディレクトリ構成

- `apps/api`
  - `src/index.ts`: Workers API 実装（投票API + 定期クリーンアップ）
  - `migrations/0001_init.sql`: D1スキーマ
  - `wrangler.toml`: Cloudflare設定
- `apps/web`
  - `App.tsx`: Expo Goで動く最小UI（投票/投稿 + API URL設定）
  - `src/api.ts`: APIクライアント
  - `src/types.ts`: 型定義
  - `package.json`: Expo起動スクリプト

## APIエンドポイント（実装済み）

- `GET /api/v1/health`
- `POST /api/v1/sessions/init`
- `POST /api/v1/polls`
- `GET /api/v1/polls/next`
- `POST /api/v1/polls/:id/vote`
- `GET /api/v1/polls/:id/result`

## 再開メモ

- `apps/api/wrangler.toml` は開発用に `BYPASS_TURNSTILE = "true"` になっています。
- この状態なら `apps/web` の投稿画面で Turnstile token を空欄のまま投稿できます。
- 本番寄りに動かす場合は `BYPASS_TURNSTILE = "false"` にして、`TURNSTILE_SECRET` と実際の token を使ってください。

## 次に動かす手順

1. `apps/web` で依存関係を入れる: `npm install`
2. Expo を起動する: `npm run start`
3. `apps/api` で Worker を起動する: `wrangler dev`
4. Expo 側の `API URL` に Worker のURLを入れる
