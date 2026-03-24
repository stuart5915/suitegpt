// publicgoods.tech — Articles/Blog API
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'GET') {
        // Single article by slug
        if (req.query.slug) {
            const { data, error } = await supabase.from('pgt_articles').select('*').eq('slug', req.query.slug).eq('status', 'published').single();
            if (error || !data) return res.status(404).json({ error: 'Article not found' });
            // Increment views
            await supabase.from('pgt_articles').update({ views: (data.views || 0) + 1 }).eq('id', data.id);
            return res.json({ article: data });
        }
        // List articles
        let query = supabase.from('pgt_articles').select('id,title,slug,excerpt,cover_image,author_name,author_x_handle,category,tags,published_at,total_tips,total_claws_earned,views').eq('status', 'published').order('published_at', { ascending: false });
        if (req.query.category && req.query.category !== 'all') query = query.eq('category', req.query.category);
        if (req.query.search) query = query.ilike('title', `%${req.query.search}%`);
        const { data, error } = await query.limit(30);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ articles: data || [] });
    }

    if (req.method === 'POST') {
        const { title, content, excerpt, cover_image, author_wallet, author_name, author_x_handle, category, tags } = req.body;
        if (!title || !content) return res.status(400).json({ error: 'title and content required' });
        if (!author_wallet) return res.status(400).json({ error: 'Connect wallet to submit' });
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
        const autoExcerpt = excerpt || content.replace(/[#*_\[\]]/g, '').slice(0, 200) + '...';
        const { data, error } = await supabase.from('pgt_articles').insert({
            title, slug, content, excerpt: autoExcerpt, cover_image,
            author_wallet, author_name, author_x_handle,
            category: category || 'news', tags: tags || [],
            status: 'review'
        }).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ ok: true, article: data, message: 'Submitted for review' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
