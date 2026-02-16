-- Allow authenticated family members to upload/update images in test-images
-- when the path is <record_id>/<filename> and the record belongs to their family.
-- Fixes: "new row violates row-level security policy" on storage upload.

DROP POLICY IF EXISTS "Users can upload images" ON storage.objects;

CREATE POLICY "Family members can upload record images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'test-images'
  AND EXISTS (
    SELECT 1
    FROM public.records r
    WHERE r.id::text = (storage.foldername(name))[1]
      AND public.is_family_member(r.family_id, auth.uid())
  )
);

-- Allow UPDATE (required for upsert: true) for same family-record paths
CREATE POLICY "Family members can update record images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'test-images'
  AND EXISTS (
    SELECT 1
    FROM public.records r
    WHERE r.id::text = (storage.foldername(name))[1]
      AND public.is_family_member(r.family_id, auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'test-images'
  AND EXISTS (
    SELECT 1
    FROM public.records r
    WHERE r.id::text = (storage.foldername(name))[1]
      AND public.is_family_member(r.family_id, auth.uid())
  )
);
