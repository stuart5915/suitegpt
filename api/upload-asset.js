// Upload build assets (images) for Build Studio apps
// POST /api/upload-asset — upload an image, returns public URL

import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = [
    'https://suitegpt.app',
    'https://www.suitegpt.app',
    'https://getsuite.app',
    'https://www.getsuite.app'
];

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAX_SIZE = 3 * 1024 * 1024; // 3MB

const ALLOWED_TYPES = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp'
};

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Authenticate via Supabase JWT
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    try {
        const { file_data, file_name, file_type } = req.body;

        if (!file_data || !file_name) {
            return res.status(400).json({ error: 'Missing file_data or file_name' });
        }

        const mimeType = file_type || 'application/octet-stream';
        const ext = ALLOWED_TYPES[mimeType];
        if (!ext) {
            return res.status(400).json({ error: 'Only images allowed (PNG, JPEG, GIF, WebP)' });
        }

        // Decode base64
        const base64Match = file_data.match(/^data:[^;]+;base64,(.+)$/);
        const raw = base64Match ? base64Match[1] : file_data;
        const buffer = Buffer.from(raw, 'base64');

        if (buffer.length > MAX_SIZE) {
            return res.status(400).json({ error: 'File too large (max 3MB)' });
        }

        const safeName = file_name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
        const storagePath = `builds/${user.id}/${Date.now()}_${safeName}`;

        const { error: uploadError } = await supabase.storage
            .from('app-assets')
            .upload(storagePath, buffer, {
                contentType: mimeType,
                upsert: false
            });

        if (uploadError) {
            return res.status(500).json({ error: 'Upload failed', details: uploadError.message });
        }

        const { data: urlData } = supabase.storage
            .from('app-assets')
            .getPublicUrl(storagePath);

        return res.status(200).json({
            url: urlData.publicUrl,
            file_name: file_name,
            file_type: mimeType
        });

    } catch (err) {
        console.error('Upload error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
