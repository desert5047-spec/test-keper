/*
  # Fix storage image select policy

  1. Normalize records.photo_uri to storage path (if URL)
  2. Remove public select policy on storage.objects
  3. Allow authenticated family members to read images
*/

-- Normalize legacy public URLs to storage paths (if any)
UPDATE public.records
SET photo_uri = regexp_replace(
  regexp_replace(
    photo_uri,
    '^https?://[^/]+/storage/v1/object/(public/)?test-images/',
    ''
  ),
  '\\?.*$',
  ''
)
WHERE photo_uri LIKE 'http%'
  AND photo_uri LIKE '%/storage/v1/object/%/test-images/%';

-- Remove public read access
DROP POLICY IF EXISTS "Images are publicly accessible" ON storage.objects;

-- Allow authenticated family members to read images
CREATE POLICY "Authenticated users can view family images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'test-images'
  AND EXISTS (
    SELECT 1
    FROM public.records r
    WHERE r.photo_uri = storage.objects.name
      AND EXISTS (
        SELECT 1
        FROM public.family_members fm
        WHERE fm.family_id = r.family_id
          AND fm.user_id = auth.uid()
      )
  )
);
