UPDATE storage.buckets
SET allowed_mime_types = ARRAY['application/pdf'],
    file_size_limit = 20971520
WHERE id = 'print-files';