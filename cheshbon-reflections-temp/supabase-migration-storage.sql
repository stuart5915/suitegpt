-- Storage Buckets for Profile
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('banners', 'banners', true) ON CONFLICT (id) DO NOTHING;

-- Storage Policies (Avatars)
-- Drop existing policies if they exist to avoid errors (or use DO block, but DROP IF EXISTS is simpler for manual runs)
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload an avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update an avatar" ON storage.objects;

CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Anyone can upload an avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Anyone can update an avatar" ON storage.objects FOR UPDATE WITH CHECK (bucket_id = 'avatars');

-- Storage Policies (Banners)
DROP POLICY IF EXISTS "Banner images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload a banner" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update a banner" ON storage.objects;

CREATE POLICY "Banner images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'banners');
CREATE POLICY "Anyone can upload a banner" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'banners');
CREATE POLICY "Anyone can update a banner" ON storage.objects FOR UPDATE WITH CHECK (bucket_id = 'banners');
