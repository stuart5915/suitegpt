import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || 'https://rdsmdywbdiskxknluiym.supabase.co',
    process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Verify admin token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.replace('Bearer ', '');
    const adminToken = sessionStorage ? null : token; // server-side
    // Simple token check — matches the proto-admin-auth flow
    try {
        const { data: tokenCheck } = await supabase
            .from('proto_golf_admin_tokens')
            .select('id')
            .eq('token', token)
            .single();

        if (!tokenCheck) {
            // Fallback: accept if token matches env var
            if (token !== process.env.PROTO_ADMIN_TOKEN) {
                return res.status(401).json({ error: 'Invalid token' });
            }
        }
    } catch {
        // If token table doesn't exist, fall back to env check
        if (token !== process.env.PROTO_ADMIN_TOKEN) {
            return res.status(401).json({ error: 'Invalid token' });
        }
    }

    if (req.method === 'POST') {
        return handleUpload(req, res);
    } else if (req.method === 'DELETE') {
        return handleDelete(req, res);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleUpload(req, res) {
    const { image_base64, product_id, variant_key, sort_order } = req.body;

    if (!image_base64 || !product_id || !variant_key) {
        return res.status(400).json({ error: 'Missing required fields: image_base64, product_id, variant_key' });
    }

    try {
        // Decode base64
        const matches = image_base64.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!matches) {
            return res.status(400).json({ error: 'Invalid base64 image format. Expected data:image/TYPE;base64,...' });
        }

        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const fileName = `${product_id}/${variant_key.replace(/\|/g, '-').replace(/\s/g, '_')}/${Date.now()}.${ext}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('proto-golf-images')
            .upload(fileName, buffer, {
                contentType: `image/${matches[1]}`,
                upsert: false
            });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            return res.status(500).json({ error: 'Failed to upload image', details: uploadError.message });
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('proto-golf-images')
            .getPublicUrl(fileName);

        const publicUrl = urlData.publicUrl;

        // Insert DB record
        const { data: record, error: dbError } = await supabase
            .from('proto_golf_product_images')
            .insert({
                product_id,
                variant_key,
                image_url: publicUrl,
                sort_order: sort_order || 0
            })
            .select()
            .single();

        if (dbError) {
            console.error('DB error:', dbError);
            return res.status(500).json({ error: 'Failed to save image record', details: dbError.message });
        }

        return res.status(200).json({
            success: true,
            image: record
        });
    } catch (err) {
        console.error('Upload handler error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function handleDelete(req, res) {
    const { image_id } = req.body;

    if (!image_id) {
        return res.status(400).json({ error: 'Missing required field: image_id' });
    }

    try {
        // Get the image record first
        const { data: image, error: fetchError } = await supabase
            .from('proto_golf_product_images')
            .select('*')
            .eq('id', image_id)
            .single();

        if (fetchError || !image) {
            return res.status(404).json({ error: 'Image not found' });
        }

        // Extract storage path from URL
        const urlParts = image.image_url.split('/proto-golf-images/');
        if (urlParts.length === 2) {
            const storagePath = decodeURIComponent(urlParts[1]);
            await supabase.storage
                .from('proto-golf-images')
                .remove([storagePath]);
        }

        // Delete DB record
        const { error: deleteError } = await supabase
            .from('proto_golf_product_images')
            .delete()
            .eq('id', image_id);

        if (deleteError) {
            console.error('Delete error:', deleteError);
            return res.status(500).json({ error: 'Failed to delete image record', details: deleteError.message });
        }

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('Delete handler error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
