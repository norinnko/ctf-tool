<?php
/**
 * CTF Tool DB - OpenAI 解説プロキシ
 * APIキーをサーバー側で秘匿し、ブラウザからの要求を中継する。
 * 生成結果は cache/ にファイルキャッシュして API コストを抑える。
 * 対応: PHP 7.4 / CORESERVER 共有ホスティング
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function respond($status, array $body) {
    // CORESERVER/Apache はCGI実行時に4xx/5xxのレスポンスボディを破棄するため、
    // 常に200で返し、エラーはJSONの error フィールドで通知する。
    http_response_code(200);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['error' => 'POSTメソッドのみ対応しています。']);
}

/* ---- 設定ファイル読み込み（webroot外を優先） ---- */
$configCandidates = [
    __DIR__ . '/../../config.php', // public_html の外（推奨）
    __DIR__ . '/../config.php',    // public_html 直下（.htaccessで保護）
];
$loaded = false;
foreach ($configCandidates as $path) {
    if (is_file($path)) {
        require $path;
        $loaded = true;
        break;
    }
}
if (!$loaded || !defined('OPENAI_API_KEY') || OPENAI_API_KEY === '' || OPENAI_API_KEY === 'sk-xxxxx') {
    respond(500, ['error' => 'APIキーが未設定です。config.php を作成してください。']);
}

$model = defined('OPENAI_MODEL') ? OPENAI_MODEL : 'gpt-4o-mini';

/* ---- 入力の取得と検証 ---- */
$raw = file_get_contents('php://input');
$in = json_decode($raw, true);
if (!is_array($in)) {
    respond(400, ['error' => 'リクエスト形式が不正です。']);
}

$id = isset($in['id']) ? (string) $in['id'] : '';
$name = isset($in['name']) ? trim((string) $in['name']) : '';
$category = isset($in['category']) ? trim((string) $in['category']) : '';

if ($name === '' || strlen($name) > 80) {
    respond(400, ['error' => 'ツール名が不正です。']);
}

/* ---- キャッシュ確認 ---- */
$cacheDir = __DIR__ . '/cache';
if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0755, true);
}
$safeId = preg_replace('/[^a-z0-9_\-]/i', '', $id);
$cacheFile = ($safeId !== '') ? $cacheDir . '/' . $safeId . '.txt' : '';

if ($cacheFile !== '' && is_file($cacheFile)) {
    $cached = file_get_contents($cacheFile);
    if ($cached !== false && $cached !== '') {
        respond(200, ['text' => $cached, 'cached' => true]);
    }
}

/* ---- プロンプト構築 ---- */
$systemPrompt = <<<SYS
あなたはCTF(Capture The Flag)とセキュリティに精通した日本語のメンターです。
指定されたツールについて、CTF初〜中級者向けに簡潔に解説してください。
出力ルール:
- 日本語、プレーンテキスト（Markdown記号や見出しは使わない）
- 3〜4文、合計250文字程度
- 「何をするツールか」「CTFでの典型的な使いどころ」「実践のコツやよくある落とし穴」を自然な文章で含める
- 攻撃を助長する具体的悪用手順ではなく、学習者が理解できる概念とワークフロー重視で書く
SYS;

$userPrompt = "ツール名: {$name}";
if ($category !== '') {
    $userPrompt .= "\nカテゴリ: {$category}";
}
$userPrompt .= "\nこのツールについて上記ルールで解説してください。";

$payload = [
    'model' => $model,
    'messages' => [
        ['role' => 'system', 'content' => $systemPrompt],
        ['role' => 'user', 'content' => $userPrompt],
    ],
    'temperature' => 0.5,
    'max_tokens' => 500,
];

/* ---- OpenAI 呼び出し ---- */
$ch = curl_init('https://api.openai.com/v1/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . OPENAI_API_KEY,
    ],
    CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
    CURLOPT_TIMEOUT => 40,
    CURLOPT_CONNECTTIMEOUT => 10,
]);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr = curl_error($ch);
curl_close($ch);

if ($response === false) {
    respond(502, ['error' => 'OpenAIへの接続に失敗しました: ' . $curlErr]);
}

$data = json_decode($response, true);

if ($httpCode !== 200) {
    $msg = isset($data['error']['message']) ? $data['error']['message'] : "OpenAI APIエラー (HTTP {$httpCode})";
    respond(502, ['error' => $msg]);
}

$text = isset($data['choices'][0]['message']['content'])
    ? trim($data['choices'][0]['message']['content'])
    : '';

if ($text === '') {
    respond(502, ['error' => 'AIからの応答が空でした。']);
}

/* ---- キャッシュ保存 ---- */
if ($cacheFile !== '') {
    @file_put_contents($cacheFile, $text, LOCK_EX);
}

respond(200, ['text' => $text, 'cached' => false]);
