# manga-tracker 引継ぎメモ

最終確認日: 2026-10-08

## 概要

漫画の「読んだ／まだ読んでない」を管理するための個人用リポジトリ。中身は**互いに独立した2つの仕組み**でできている。

| # | 名前 | 場所 | 何をするか | 状態 |
|---|------|------|-----------|------|
| 1 | 漫画蔵（ブックマークアプリ） | `manga-bookmark/index.html` | ブラウザで開く1ファイル完結の既読管理アプリ | ✅ 動作する |
| 2 | 新着チェッカー | `scripts/check.js` + `.github/workflows/check.yml` + `data/manga.json` | GitHub Actions で毎朝サイトを取得し最新話数を記録 | ⚠ 実質動いていない（下記） |

> 1 と 2 はデータを共有していない。アプリは `data/manga.json` を読まず、チェッカーはアプリの localStorage を知らない。

## ファイル構成

```
.github/workflows/check.yml   新着チェックの定期実行（毎日 6:00 JST）
scripts/check.js              新着チェック本体（Node 20、依存パッケージなし）
data/manga.json               チェック対象リストと結果（Actions が自動上書き）
manga-bookmark/index.html     漫画蔵アプリ（HTML/CSS/JS 1ファイル）
```

---

## 1. 漫画蔵（`manga-bookmark/index.html`）

### 使い方
- ファイルをブラウザで開くだけ。ビルド・サーバ不要（Google Fonts のみ外部読み込み）。
- 「＋ 追加」でタイトル・連載頻度（週刊／月刊）・URL・メモを登録。
- 「✓ 読んだ」で既読にすると下へ移動。上に残っているのが未読。
- ★でお気に入り（常に最上位）、タイトルをタップで編集、×で削除（確認あり）。
- タブ（すべて／週刊／月刊）と検索（タイトル・メモ）で絞り込み。

### データ保存
- ブラウザの `localStorage`、キー `manga-bookmarks-v3-local`。
- **端末・ブラウザごとに別データ**。同期・バックアップ機能はない。ブラウザのデータ削除で消える。
- 読み込み失敗時は誤上書き防止のため保存を停止し、エラーバナーを出す。

### 1件のデータ形式
```json
{
  "id": "文字列（自動生成）",
  "title": "タイトル",
  "url": "https://...",
  "note": "メモ",
  "frequency": "weekly | monthly",
  "favorite": false,
  "addedAt": 1700000000000,
  "lastReadAt": null
}
```
`lastReadAt` が `null` なら未読。

---

## 2. 新着チェッカー

### 仕組み
1. `.github/workflows/check.yml` が毎日 UTC 21:00（JST 6:00）に起動（手動実行 `workflow_dispatch` も可）。
2. `node scripts/check.js` が `data/manga.json` の各 `url` を取得。
3. HTML から `○○話` / `Chapter ○○` / `Ch.○○` の数字を正規表現で拾い、最大値を `latestChapter` に保存。AI 推測は使わない方針。
4. 結果の `data/manga.json` を「🔄 新着チェック自動更新」として自動コミット。

### `data/manga.json` の項目
| キー | 意味 |
|------|------|
| `id` | 識別子 |
| `title` | タイトル |
| `url` | チェック先ページ |
| `chapter` | 自分が読んだ話数（手入力） |
| `latestChapter` | 検出した最新話数（自動） |
| `lastCheckedAt` | 最終チェック時刻（ms） |
| `lastCheckError` | エラー内容（成功時は `null`） |

現在の登録は1件のみ：「SSS級ランカー回帰する」（既読 192 話）。

### ⚠ 現状の問題（引継ぎ時に要対応）
1. **URL が 404**：`https://soraraw.com/manga/sss-kyuu-rankaa-kaiki-suru-5287` が `HTTP 404` を返し、`latestChapter` は `null` のまま。URL の差し替えか、取得先サイトの見直しが必要（ボット対策で弾かれている可能性もある）。
2. **デバッグモードのまま**：`check.js` は本文の先頭 300 文字（`bodyPreview`）しか話数検出に使っていない。ページ全体を対象にするには `extractChapterNumbers(bodyPreview)` を本文全体に変える必要がある。ログにヘッダー等も大量に出る。
3. **毎日コミットが増え続ける**：`lastCheckedAt` が毎回変わるため、成果がなくても毎日1コミット発生する（2026-08-19 から継続中）。止めるなら Actions の workflow を無効化する。
4. **通知がない**：新着を検出しても知らせる仕組みはない。`data/manga.json` を見に行く必要がある。

### 対象作品の追加方法
`data/manga.json` の配列に `id` / `title` / `url` / `chapter` を持つオブジェクトを追記してコミット。残りの項目は次回実行時に自動で埋まる。

---

## ブランチ
- `main`：本線。Actions の自動コミットもここに入る。
- `claude/charming-knuth-01852f`：作業用（この引継ぎメモを追加）。

## 次にやるとよいこと（提案）
- 取得できるチェック先 URL に差し替える → 手動実行で `latestChapter` が埋まるか確認
- `check.js` のデバッグ出力を外し、本文全体から話数を拾うよう戻す
- `latestChapter > chapter` のときだけ Issue 作成などで通知する
- 漫画蔵に JSON エクスポート／インポートを付けてバックアップできるようにする
