-- 既存データ救済: photo_uri の先頭 "test-images/" を除去して path のみに統一する
-- 実行後、getPublicImageUrl が正しい public URL を生成できるようになる
UPDATE public.records
SET photo_uri = regexp_replace(photo_uri, '^test-images/', '')
WHERE photo_uri LIKE 'test-images/%';
