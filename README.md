# CTF Tool DB

CTF(Capture The Flag)で使うツールをカテゴリ別にまとめた辞典サイト。
各ツールの「使いどころ」をOpenAI(ChatGPT)が日本語で解説します。

- カテゴリ別タブ（Web / Forensics・OSINT / Crypto / Pwn・Rev）と全文検索
- 40ツール収録（各カテゴリ10個）
- AI解説はサーバー側でAPIキーを秘匿し、結果をキャッシュしてコスト削減
- 静的フロント + PHPプロキシ構成（CORESERVER等のPHP共有ホスティングで動作）

---

## ファイル構成

```
public_html/                ← ctf-tool.norinko.jp のドキュメントルート
├── index.html
├── css/style.css
├── js/app.js
├── data/tools.json         ← ツールデータ（ここを編集すれば項目追加可）
├── api/
│   ├── explain.php         ← OpenAIプロキシ
│   └── cache/              ← AI解説のキャッシュ（自動生成・要書込権限）
├── .htaccess
└── config.sample.php       ← コピー元（config.php は別途作成）

config.php                  ← 【推奨】public_html の1つ上に置く
```

---

## セットアップ手順（CORESERVER）

### 1. OpenAI APIキーを用意
[platform.openai.com](https://platform.openai.com/api-keys) でAPIキー（`sk-...`）を発行。

### 2. config.php を作成
`config.sample.php` を `config.php` という名前でコピーし、キーを設定:

```php
define('OPENAI_API_KEY', 'sk-あなたのキー');
define('OPENAI_MODEL', 'gpt-4o-mini');
```

### 3. ファイルをアップロード
FTPまたはファイルマネージャで、`ctf-tool/` の中身を
`/domains/ctf-tool.norinko.jp/public_html/` にアップロード。

**config.php の置き場所（重要）**
- 推奨: `/domains/ctf-tool.norinko.jp/config.php`（public_htmlの外＝Webから読めない）
- 簡易: `public_html/config.php`（同梱 `.htaccess` が直接アクセスを遮断）

`explain.php` は上記どちらの場所も自動で探します。

### 4. cache ディレクトリの書込権限
`api/cache/` に書込権限（パーミッション 755 または 705）を付与。
無くても動きますが、付与するとAI解説がキャッシュされコスト削減になります。

### 5. PHPバージョン
CORESERVERのコントロールパネルで `ctf-tool.norinko.jp` のPHPを
**7.4以上**にしておく（cURL有効が前提。通常デフォルトで有効）。

### 6. 動作確認
1. `https://ctf-tool.norinko.jp/` を開く → ツール一覧が表示される
2. 検索・カテゴリ切替が動く
3. 「AIにこのツールを解説してもらう」→ 解説が表示される

---

## コストについて
- `gpt-4o-mini` は非常に安価（1解説あたり概ね 0.01〜0.05円程度）
- 一度生成した解説は `api/cache/` に保存され、次回以降はAPIを呼ばない
- 全40ツールを一巡しても数円程度

---

## ツールの追加・編集
`data/tools.json` の `tools` 配列に項目を足すだけ。サーバー再起動は不要。

```json
{
  "id": "newtool",
  "name": "ツール名",
  "category": "web",
  "difficulty": 2,
  "tagline": "一言説明",
  "when_to_use": "どんな時に使うか",
  "use_cases": ["用途1", "用途2"],
  "command": "example --command",
  "tags": ["tag1", "tag2"],
  "sources": [{ "label": "公式", "url": "https://example.com" }]
}
```

- `category`: `web` / `forensics` / `crypto` / `pwn`
- `difficulty`: 1(入門) / 2(中級) / 3(上級)

---

## セキュリティ・注意
- `config.php` は公開リポジトリにコミットしない
- 掲載ツールは教育・学習目的。必ず**許可された環境**でのみ使用すること
