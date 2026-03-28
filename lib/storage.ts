/**
 * Supabase Storage の画像URL取得モジュール
 *
 * ── Egress 超過対策 ──
 * Supabase Free Plan の Egress (5GB) を超過した原因:
 *   1. 一覧画面で全レコードのフルサイズ画像を毎回取得していた
 *   2. Signed URL は毎回トークンが変わるため expo-image のキャッシュが効かなかった
 *   3. タブ切り替え・月切り替えのたびに全画像の Signed URL を再生成していた
 *
 * 対策:
 *   - Signed URL をインメモリキャッシュし、50分間は再利用する
 *   - 一覧用途は getThumbImageUrl() で幅800pxのサムネイルを返す
 *   - 詳細・編集は getSignedImageUrl() でフルサイズを返す
 *   - アプリ内で直接 createSignedUrl() を呼ばない（必ずこのモジュール経由）
 */
import { supabase, storageBucket as BUCKET } from '@/lib/supabase';

const SIGNED_URL_EXPIRES_SEC = 60 * 60; // 1時間
const CACHE_TTL_MS = 50 * 60 * 1000;    // 50分（期限の10分前に更新）

interface CachedUrl {
  url: string;
  expiresAt: number;
}

const urlCache = new Map<string, CachedUrl>();

function getCacheKey(path: string, width?: number): string {
  return width ? `${path}__w${width}` : path;
}

/**
 * Storage の path から Signed URL を取得する。
 * 同一 path + width の組み合わせに対して50分間キャッシュを返す。
 *
 * @param path バケット内パス（例: "uuid/timestamp.jpg"）
 * @param options.width 指定すると Supabase Image Transformation で縮小
 */
export async function getSignedImageUrl(
  path: string,
  options?: { width?: number }
): Promise<string> {
  const key = getCacheKey(path, options?.width);
  const cached = urlCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const transformOpts = options?.width
    ? { transform: { width: options.width, resize: 'contain' as const } }
    : undefined;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRES_SEC, transformOpts);

  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Signed URL を取得できませんでした');

  urlCache.set(key, {
    url: data.signedUrl,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return data.signedUrl;
}

/**
 * サムネイルURL。用途に応じて width を指定する。
 *
 * - 一覧（96px 表示）→ width=300（Retina 3x で十分）
 * - ホーム（カード幅 ≈ 画面幅-32px）→ width=800（デフォルト）
 *
 * ⚠ Supabase Free Plan では Image Transformation は無効。
 *   transform パラメータは無視され、フルサイズが返る。
 *   Pro Plan 以上で自動的にサムネイルが効く。
 */
export async function getThumbImageUrl(
  path: string,
  width: number = 800,
): Promise<string> {
  return getSignedImageUrl(path, { width });
}

/**
 * path または URL から Signed URL を取得する（null 安全）。
 * detail.tsx など、DB の photo_uri をそのまま渡せる汎用版。
 */
export async function resolveImageUrl(
  uriOrPath: string | null
): Promise<string | null> {
  if (!uriOrPath) return null;

  let path = uriOrPath;

  if (/^https?:\/\//.test(uriOrPath)) {
    const extracted = extractStoragePath(uriOrPath);
    if (!extracted) return uriOrPath;
    path = extracted;
  }

  if (path.startsWith('file:') || path.startsWith('content:')) {
    return null;
  }

  try {
    return await getSignedImageUrl(path);
  } catch {
    return null;
  }
}

/**
 * Supabase Storage の URL からバケット内パスを抽出する。
 */
function extractStoragePath(url: string): string | null {
  try {
    const marker = '/storage/v1/object/';
    const index = url.indexOf(marker);
    if (index === -1) return null;
    const after = url.substring(index + marker.length);
    const parts = after.split('/');
    if (parts[0] === 'public' || parts[0] === 'sign') parts.shift();
    const bucket = parts.shift();
    if (!bucket || bucket !== BUCKET) return null;
    return parts.join('/').split('?')[0] || null;
  } catch {
    return null;
  }
}

export function clearImageUrlCache(): void {
  urlCache.clear();
}
