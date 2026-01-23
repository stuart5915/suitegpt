-- Create the dev-updates storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('dev-updates', 'dev-updates', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to all files in the bucket
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'dev-updates');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated Upload" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'dev-updates');

-- Allow service role full access (for API calls)
CREATE POLICY "Service Role Full Access" ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'dev-updates');
