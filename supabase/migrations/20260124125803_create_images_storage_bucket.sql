/*
  # Create Images Storage Bucket

  1. Storage
    - Create a public bucket for test/record images
    - Enable RLS on the bucket
    - Add policies for authenticated users to upload and read images

  2. Security
    - Users can upload images (authenticated only)
    - Images are publicly readable
    - Users can only delete their own images
*/

-- Create storage bucket for images
INSERT INTO storage.buckets (id, name, public)
VALUES ('test-images', 'test-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images
CREATE POLICY "Users can upload images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'test-images');

-- Allow public read access to images
CREATE POLICY "Images are publicly accessible"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'test-images');

-- Allow users to delete their own images
CREATE POLICY "Users can delete own images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'test-images' AND (storage.foldername(name))[1] = auth.uid()::text);
