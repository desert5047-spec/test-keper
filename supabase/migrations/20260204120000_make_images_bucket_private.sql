-- Make test-images bucket private for signed URL access
update storage.buckets
set public = false
where id = 'test-images';
