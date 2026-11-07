#!/usr/bin/env node
// PUT một file local lên signed URL mà Linear MCP `prepare_file_upload` trả về,
// rồi in ra dòng markdown ảnh để dán vào comment / sub task.
//
//   node .claude/skills/qc-verify-production/scripts/linear-put.mjs <file> [caption] <<'JSON'
//   { ...nguyên kết quả prepare_file_upload (hoặc chỉ uploadRequest)... }
//   JSON
//
// Signed URL chỉ sống 60s và mọi header đều nằm trong chữ ký — gửi nguyên văn,
// không đổi hoa/thường. Vì vậy: prepare 1 file → chạy script này ngay → file tiếp theo.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const [file, caption] = process.argv.slice(2);
if (!file) {
  console.error('usage: node linear-put.mjs <file> [caption] < prepare_file_upload-result.json');
  process.exit(2);
}

const res = JSON.parse(readFileSync(0, 'utf8'));
const req = res.uploadRequest ?? res;
const url = req.url ?? req.uploadUrl;
if (!url) {
  console.error('Không thấy uploadRequest.url trong JSON stdin');
  process.exit(2);
}

let headers = req.headers ?? {};
if (Array.isArray(headers)) {
  headers = Object.fromEntries(headers.map((h) => [h.key ?? h.name, h.value]));
}
// fetch tự đặt content-length bằng đúng kích thước body; đặt tay thì undici từ chối.
for (const k of Object.keys(headers)) if (k.toLowerCase() === 'content-length') delete headers[k];

const r = await fetch(url, { method: 'PUT', headers, body: readFileSync(file) });
if (!r.ok) {
  console.error(`PUT ${r.status}: ${(await r.text()).slice(0, 500)}`);
  process.exit(1);
}

const assetUrl = res.assetUrl ?? req.assetUrl ?? res.asset?.url;
if (!assetUrl) {
  console.log(res.markdown ?? '(PUT OK nhưng JSON không có assetUrl — lấy markdown từ kết quả prepare)');
} else if (/\.(mp4|webm|mov)$/i.test(file)) {
  // Video: link (Linear plays it inline), same shape as the dev team's "🎬 Video:" links.
  console.log(`[🎬 Video: ${caption ?? basename(file)}](${assetUrl})`);
} else {
  console.log(`![${caption ?? basename(file)}](${assetUrl})`);
}
