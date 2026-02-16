import { supabase } from '@/lib/supabase';

const BUCKET = 'test-images';
const SIGNED_URL_EXPIRES_SEC = 60 * 30; // 30分

/**
 * Storage の path から Signed URL を取得する。
 * 認証が必要なバケットの画像を Image で表示するときに使用する。
 * @param path - バケット内パス（例: "uuid/timestamp.jpg"）。フルURLは渡さない。
 */
export async function getSignedImageUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRES_SEC);

  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Signed URL を取得できませんでした');
  return data.signedUrl;
}
