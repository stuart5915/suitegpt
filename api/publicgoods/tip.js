// publicgoods.tech — CLAWS Tipping API
// Publish0x-style: reader tips, both earn from pool. Reader chooses split.
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// CLAWS per tip (from pool — configurable)
const CLAWS_PER_TIP = parseInt(process.env.PGT_CLAWS_PER_TIP || '100');
// Cooldown: 1 tip per article per wallet per hour
const TIP_COOLDOWN_MS = 60 * 60 * 1000;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const { article_id, tipper_wallet, author_split } = req.body;
    if (!article_id || !tipper_wallet) return res.status(400).json({ error: 'article_id and tipper_wallet required' });

    const split = Math.min(100, Math.max(0, parseInt(author_split) || 80));

    try {
        // Get article
        const { data: article, error: artErr } = await supabase.from('pgt_articles').select('id,author_wallet,title').eq('id', article_id).single();
        if (artErr || !article) return res.status(404).json({ error: 'Article not found' });

        // Can't tip your own article
        if (article.author_wallet && article.author_wallet.toLowerCase() === tipper_wallet.toLowerCase()) {
            return res.status(400).json({ error: "Can't tip your own article" });
        }

        // Cooldown check
        const cooldownTime = new Date(Date.now() - TIP_COOLDOWN_MS).toISOString();
        const { data: recent } = await supabase.from('pgt_tips')
            .select('id')
            .eq('article_id', article_id)
            .eq('tipper_wallet', tipper_wallet.toLowerCase())
            .gte('created_at', cooldownTime)
            .limit(1);
        if (recent && recent.length > 0) {
            return res.status(429).json({ error: 'You already tipped this article recently. Try again later.' });
        }

        // Calculate split
        const totalClaws = CLAWS_PER_TIP;
        const authorClaws = Math.floor(totalClaws * split / 100);
        const readerClaws = totalClaws - authorClaws;

        // Record tip
        const { error: tipErr } = await supabase.from('pgt_tips').insert({
            article_id,
            tipper_wallet: tipper_wallet.toLowerCase(),
            author_wallet: (article.author_wallet || '').toLowerCase(),
            author_split: split,
            total_claws: totalClaws,
            author_claws: authorClaws,
            reader_claws: readerClaws
        });
        if (tipErr) throw tipErr;

        // Update article totals
        await supabase.from('pgt_articles').update({
            total_tips: (article.total_tips || 0) + 1,
            total_claws_earned: (article.total_claws_earned || 0) + totalClaws
        }).eq('id', article_id);

        return res.json({
            ok: true,
            tip: {
                total_claws: totalClaws,
                author_earned: authorClaws,
                reader_earned: readerClaws,
                split: split
            },
            message: `Tipped! Author gets ${authorClaws} CLAWS, you get ${readerClaws} CLAWS`
        });

    } catch (e) {
        console.error('[PGT Tip] Error:', e.message);
        return res.status(500).json({ error: 'Tip failed' });
    }
}
