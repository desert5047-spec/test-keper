#!/usr/bin/env node
/**
 * 手順3用: supabase/migrations 内で
 * - RLS が有効なテーブル一覧
 * - 各テーブルに CREATE POLICY が少なくとも1つあるか
 * をチェックする。RLS ありでポリシーなしがあれば exit 1 で終了。
 *
 * 使い方: node scripts/check-migrations-rls.js
 */

const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
if (!fs.existsSync(migrationsDir)) {
  console.error('supabase/migrations が見つかりません');
  process.exit(2);
}

const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
let allSql = '';
for (const f of files) {
  allSql += fs.readFileSync(path.join(migrationsDir, f), 'utf8') + '\n';
}

// ALTER TABLE [schema.]table_name ENABLE ROW LEVEL SECURITY
const rlsTables = new Set();
const rlsRe = /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:([a-z_]+)\.)?([a-z_]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
let m;
while ((m = rlsRe.exec(allSql)) !== null) {
  const schema = (m[1] || 'public').toLowerCase();
  const table = m[2].toLowerCase();
  rlsTables.add(`${schema}.${table}`);
}

// CREATE POLICY ... ON [schema.]table_name（改行や空白の有無を許容）
const policyTables = new Set();
const policyRe = /CREATE\s+POLICY\s+[\s\S]+?ON\s+(?:([a-z_]+)\.)?([a-z_]+)/gi;
while ((m = policyRe.exec(allSql)) !== null) {
  const schema = (m[1] || 'public').toLowerCase();
  const table = m[2].toLowerCase();
  policyTables.add(`${schema}.${table}`);
}

// storage.objects は storage スキーマなので RLS テーブル一覧には通常含まれないが、
// もし RLS をかけている場合はポリシーが必要。ここでは public のみチェック
const publicRlsTables = [...rlsTables].filter((t) => t.startsWith('public.'));
const missing = publicRlsTables.filter((t) => !policyTables.has(t));

console.log('--- RLS が有効なテーブル (public) ---');
publicRlsTables.forEach((t) => console.log('  ', t));
console.log('');
console.log('--- ポリシーが定義されているテーブル ---');
[...policyTables].filter((t) => t.startsWith('public.')).sort().forEach((t) => console.log('  ', t));

if (missing.length > 0) {
  console.error('');
  console.error('NG: RLS が有効なのにポリシーが 1 つもないテーブルがあります。先にポリシーを追加してから push してください。');
  missing.forEach((t) => console.error('  -', t));
  process.exit(1);
}

console.log('');
console.log('OK: RLS が有効な public テーブルにはいずれもポリシーが定義されています。');
process.exit(0);
