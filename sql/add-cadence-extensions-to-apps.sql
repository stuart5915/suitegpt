-- =====================================================
-- Add Cadence Extensions to Apps Table
-- Run this in Supabase SQL Editor
-- =====================================================

-- Insert Social Engager
INSERT INTO apps (slug, name, tagline, description, emoji_icon, category, url, status)
VALUES (
    'social-engager',
    'Social Engager',
    'Auto-engage with posts based on keywords & accounts',
    'Automatically like, reply, retweet, and engage with relevant content. Set up rules based on keywords, accounts, or hashtags. Warm up leads before DMs with natural engagement patterns.',
    '💬',
    'marketing',
    'https://cadence-ai-nextjs.vercel.app/extensions/social-engager',
    'live'
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    description = EXCLUDED.description,
    emoji_icon = EXCLUDED.emoji_icon,
    category = EXCLUDED.category,
    url = EXCLUDED.url,
    status = EXCLUDED.status;

-- Insert AI Image Generator
INSERT INTO apps (slug, name, tagline, description, emoji_icon, category, url, status)
VALUES (
    'image-generator',
    'AI Image Generator',
    'Create stunning social media graphics with AI',
    'Generate professional social media images with AI. Choose from multiple styles (minimal, bold, professional, playful, luxury, tech) and aspect ratios. Consistent brand visuals in seconds.',
    '🎨',
    'marketing',
    'https://cadence-ai-nextjs.vercel.app/extensions/image-generator',
    'live'
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    description = EXCLUDED.description,
    emoji_icon = EXCLUDED.emoji_icon,
    category = EXCLUDED.category,
    url = EXCLUDED.url,
    status = EXCLUDED.status;

-- Insert Thread Writer
INSERT INTO apps (slug, name, tagline, description, emoji_icon, category, url, status)
VALUES (
    'thread-writer',
    'Thread Writer',
    'Turn blog posts into viral Twitter threads',
    'Convert any blog post, article, or idea into an engaging Twitter thread. AI optimizes hooks, CTAs, and formatting. Edit tweets inline and schedule via Cadence.',
    '🧵',
    'marketing',
    'https://cadence-ai-nextjs.vercel.app/extensions/thread-writer',
    'live'
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    description = EXCLUDED.description,
    emoji_icon = EXCLUDED.emoji_icon,
    category = EXCLUDED.category,
    url = EXCLUDED.url,
    status = EXCLUDED.status;

-- Insert Analytics Dashboard
INSERT INTO apps (slug, name, tagline, description, emoji_icon, category, url, status)
VALUES (
    'analytics-dashboard',
    'Analytics Dashboard',
    'Cross-platform social media insights',
    'Track followers, engagement, impressions across X, Instagram, and LinkedIn. See your best performing posts, optimal posting times, and content performance by type.',
    '📊',
    'marketing',
    'https://cadence-ai-nextjs.vercel.app/extensions/analytics-dashboard',
    'live'
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    description = EXCLUDED.description,
    emoji_icon = EXCLUDED.emoji_icon,
    category = EXCLUDED.category,
    url = EXCLUDED.url,
    status = EXCLUDED.status;

-- Insert Hashtag Optimizer (Coming Soon)
INSERT INTO apps (slug, name, tagline, description, emoji_icon, category, url, status)
VALUES (
    'hashtag-optimizer',
    'Hashtag Optimizer',
    'AI-powered hashtag suggestions for maximum reach',
    'Get platform-specific hashtag recommendations. Track performance, detect trending tags, and analyze competition. Automatically add to your Cadence posts.',
    '#️⃣',
    'marketing',
    'https://cadence-ai-nextjs.vercel.app/extensions/hashtag-optimizer',
    'approved'
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    description = EXCLUDED.description,
    emoji_icon = EXCLUDED.emoji_icon,
    category = EXCLUDED.category,
    url = EXCLUDED.url,
    status = EXCLUDED.status;

-- Insert Comment Responder (Coming Soon)
INSERT INTO apps (slug, name, tagline, description, emoji_icon, category, url, status)
VALUES (
    'comment-responder',
    'Comment Responder',
    'AI drafts replies to your post comments',
    'Never miss an engagement opportunity. AI generates personalized replies matching your tone. Approve or auto-send responses. Bulk respond to keep engagement high.',
    '💭',
    'marketing',
    'https://cadence-ai-nextjs.vercel.app/extensions/comment-responder',
    'approved'
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    description = EXCLUDED.description,
    emoji_icon = EXCLUDED.emoji_icon,
    category = EXCLUDED.category,
    url = EXCLUDED.url,
    status = EXCLUDED.status;

-- Insert Trend Surfer (Coming Soon)
INSERT INTO apps (slug, name, tagline, description, emoji_icon, category, url, status)
VALUES (
    'trend-surfer',
    'Trend Surfer',
    'Monitor trending topics & create timely content',
    'Real-time trend monitoring for your niche. Get content suggestions, auto-draft posts about trends, and viral potential scoring. Never miss a trending moment.',
    '🌊',
    'marketing',
    'https://cadence-ai-nextjs.vercel.app/extensions/trend-surfer',
    'approved'
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    description = EXCLUDED.description,
    emoji_icon = EXCLUDED.emoji_icon,
    category = EXCLUDED.category,
    url = EXCLUDED.url,
    status = EXCLUDED.status;

-- Insert Link in Bio (Coming Soon)
INSERT INTO apps (slug, name, tagline, description, emoji_icon, category, url, status)
VALUES (
    'link-in-bio',
    'Link in Bio',
    'Dynamic link-in-bio page with analytics',
    'Beautiful customizable link page. Track clicks, run A/B tests, and auto-update links from your Cadence campaigns. Custom domain support included.',
    '🔗',
    'marketing',
    'https://cadence-ai-nextjs.vercel.app/extensions/link-in-bio',
    'approved'
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    description = EXCLUDED.description,
    emoji_icon = EXCLUDED.emoji_icon,
    category = EXCLUDED.category,
    url = EXCLUDED.url,
    status = EXCLUDED.status;

-- Insert DM Sequence Builder (Coming Soon)
INSERT INTO apps (slug, name, tagline, description, emoji_icon, category, url, status)
VALUES (
    'dm-sequence-builder',
    'DM Sequence Builder',
    'Automated DM sequences for lead nurturing',
    'Build multi-step DM sequences with AI personalization. Trigger based on engagement actions. Handle responses automatically. Track conversion analytics.',
    '📬',
    'marketing',
    'https://cadence-ai-nextjs.vercel.app/extensions/dm-sequence-builder',
    'approved'
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    description = EXCLUDED.description,
    emoji_icon = EXCLUDED.emoji_icon,
    category = EXCLUDED.category,
    url = EXCLUDED.url,
    status = EXCLUDED.status;

-- =====================================================
-- DONE! 9 Cadence Extensions added to SUITE Shell
-- 4 Live: Social Engager, Image Generator, Thread Writer, Analytics
-- 5 Coming Soon: Hashtag, Comments, Trends, Bio Link, DM
-- =====================================================
