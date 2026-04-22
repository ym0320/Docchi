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
