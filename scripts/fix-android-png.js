#!/usr/bin/env node
/**
 * Android AAPT2 でコンパイルエラーになる PNG を 8-bit sRGB に再エンコードする。
 * メタデータを除去し、AAPT2 が受け付ける形式で上書きする。
 *
 * Usage: node scripts/fix-android-png.js [path]
 *   path: 対象 PNG（省略時は assets/images/onboarding-camera-promo.png）
 */

const path = require('path');
const fs = require('fs');

const defaultPath = path.join(
  __dirname,
  '..',
  'assets',
  'images',
  'onboarding-camera-promo.png'
);

const targetPath = path.resolve(process.argv[2] || defaultPath);

if (!fs.existsSync(targetPath)) {
  console.error('Error: File not found:', targetPath);
  process.exit(1);
}

async function main() {
  const sharp = require('sharp');

  const inputBuffer = fs.readFileSync(targetPath);
  const outPath = targetPath;

  await sharp(inputBuffer)
    .toColourspace('srgb')
    .png({
      compressionLevel: 6,
      bitdepth: 8,
    })
    .withMetadata(false)
    .toFile(outPath + '.tmp');

  fs.renameSync(outPath + '.tmp', outPath);
  console.log('OK:', outPath, '(8-bit sRGB, metadata stripped)');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
