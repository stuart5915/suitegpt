// Inclawbate — File Upload for Message Attachments
// POST /api/inclawbate/upload — upload a file, returns public URL

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from './x-callback.js';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com'
];

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAX_SIZE = 3 * 1024 * 1024; // 3MB (must fit in Vercel's 4.5MB body limit after base64)

const ALLOWED_TYPES = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
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

    const user = authenticateRequest(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { file_data, file_name, file_type } = req.body;

        if (!file_data || !file_name) {
            return res.status(400).json({ error: 'Missing file_data or file_name' });
        }

        // Validate type
        const mimeType = file_type || 'application/octet-stream';
        const ext = ALLOWED_TYPES[mimeType];
        if (!ext) {
            return res.status(400).json({ error: 'File type not allowed. Supported: images, PDF, text, Word docs.' });
        }

        // Decode base64
        const base64Match = file_data.match(/^data:[^;]+;base64,(.+)$/);
        const raw = base64Match ? base64Match[1] : file_data;
        const buffer = Buffer.from(raw, 'base64');

        if (buffer.length > MAX_SIZE) {
            return res.status(400).json({ error: 'File too large (max 3MB)' });
        }

        // Generate unique path
        const safeName = file_name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
        const storagePath = `messages/${user.sub}/${Date.now()}_${safeName}`;

        const { error: uploadError } = await supabase.storage
            .from('inclawbate-attachments')
            .upload(storagePath, buffer, {
                contentType: mimeType,
                upsert: false
            });

        if (uploadError) {
            return res.status(500).json({ error: 'Upload failed', details: uploadError.message });
        }

        const { data: urlData } = supabase.storage
            .from('inclawbate-attachments')
            .getPublicUrl(storagePath);

        return res.status(200).json({
            url: urlData.publicUrl,
            file_name: file_name,
            file_type: mimeType
        });

    } catch (err) {
        return res.status(500).json({ error: 'Internal server error' });
    }
}
