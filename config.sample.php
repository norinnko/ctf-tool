<?php
/**
 * 設定ファイルのテンプレート。
 *
 * 【使い方】
 * 1. このファイルを config.php という名前でコピー
 * 2. OPENAI_API_KEY に自分のキーを設定
 * 3. 【推奨】config.php を public_html の「1つ上の階層」に置く
 *    例: /domains/ctf-tool.norinko.jp/config.php
 *    （Webから直接読めない場所なので最も安全）
 *    public_html 直下に置く場合は同梱の .htaccess が保護します。
 *
 * ※ config.php は絶対に公開リポジトリにコミットしないこと。
 */

define('OPENAI_API_KEY', 'sk-xxxxx');   // ← 自分のOpenAI APIキーに置き換える

define('OPENAI_MODEL', 'gpt-4o-mini');  // 安価で十分。gpt-4o などに変更可
