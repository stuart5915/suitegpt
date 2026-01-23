// Publish Article to artstu.ca API
// POST /api/publish-artstu
// Commits article to GitHub, posts to X/Twitter

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL || 'https://rdsmdywbdiskxknluiym.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
    'https://getsuite.app',
    'https://www.getsuite.app',
    'http://localhost:3000',
    'http://localhost:5500'
];

// Generate slug from title
function generateSlug(title) {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 50)
        .replace(/^-|-$/g, '');
}

// Generate article HTML
function generateArticleHtml(title, content, summary, coverImageUrl, date) {
    const formattedDate = new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Convert markdown-like content to HTML
    const htmlContent = content
        .split('\n\n')
        .map(para => {
            if (para.startsWith('# ')) {
                return `<h1>${para.slice(2)}</h1>`;
            } else if (para.startsWith('## ')) {
                return `<h2>${para.slice(3)}</h2>`;
            } else if (para.startsWith('### ')) {
                return `<h3>${para.slice(4)}</h3>`;
            } else if (para.startsWith('- ')) {
                const items = para.split('\n').map(li => `<li>${li.slice(2)}</li>`).join('');
                return `<ul>${items}</ul>`;
            } else if (para.trim()) {
                return `<p>${para.replace(/\n/g, '<br>')}</p>`;
            }
            return '';
        })
        .join('\n                    ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | Stuart Hollinger</title>
    <meta name="description" content="${summary}">

    <!-- Open Graph -->
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${summary}">
    ${coverImageUrl ? `<meta property="og:image" content="${coverImageUrl}">` : ''}
    <meta property="og:type" content="article">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="@artstu">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${summary}">
    ${coverImageUrl ? `<meta name="twitter:image" content="${coverImageUrl}">` : ''}

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
    <link rel="stylesheet" href="../styles.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        .article-container {
            max-width: 720px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        .article-header {
            margin-bottom: 40px;
        }
        .article-title {
            font-size: 36px;
            font-weight: 700;
            line-height: 1.2;
            margin-bottom: 16px;
        }
        .article-meta {
            font-size: 14px;
            color: var(--muted);
        }
        .article-cover {
            width: 100%;
            border-radius: 12px;
            margin-bottom: 40px;
        }
        .article-content {
            font-size: 18px;
            line-height: 1.8;
            color: #e0e0e0;
        }
        .article-content h1, .article-content h2, .article-content h3 {
            color: var(--text);
            margin-top: 40px;
            margin-bottom: 20px;
        }
        .article-content h2 {
            font-size: 28px;
        }
        .article-content h3 {
            font-size: 22px;
        }
        .article-content p {
            margin-bottom: 24px;
        }
        .article-content ul, .article-content ol {
            margin-bottom: 24px;
            padding-left: 24px;
        }
        .article-content li {
            margin-bottom: 8px;
        }
        .back-link {
            display: inline-block;
            color: #e74c3c;
            text-decoration: none;
            font-weight: 500;
            margin-top: 60px;
            padding: 12px 0;
        }
        .back-link:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container" style="height: auto; overflow: visible;">
        <header class="header">
            <div>
                <a href="/" style="text-decoration: none; color: inherit;">
                    <div class="logo">Stuart <span>Hollinger</span></div>
                    <div class="tagline">Builder · Philosopher · Seeker</div>
                </a>
            </div>
            <nav class="header-links">
                <a href="/">Home</a>
                <a href="https://twitter.com/artstu" target="_blank">Twitter</a>
                <a href="https://getsuite.app" target="_blank">SUITE</a>
                <a href="mailto:stuart@getsuite.app">Contact</a>
            </nav>
        </header>

        <article class="article-container">
            <header class="article-header">
                <h1 class="article-title">${title}</h1>
                <p class="article-meta">${formattedDate}</p>
            </header>

            ${coverImageUrl ? `<img src="${coverImageUrl}" alt="${title}" class="article-cover">` : ''}

            <div class="article-content">
                    ${htmlContent}
            </div>

            <a href="/writings.html" class="back-link">← Back to Articles</a>
        </article>
    </div>
</body>
</html>`;
}

// Generate article entry HTML for writings.html
function generateArticleEntry(title, slug, summary, date) {
    const formattedDate = new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit'
    });

    return `<a href="articles/${slug}.html"
                            style="display: block; padding: 15px; background: rgba(255,255,255,0.02); border-radius: 8px; margin-bottom: 10px; text-decoration: none; color: inherit; border: 1px solid transparent; transition: all 0.2s;">
                            <div style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">${title}</div>
                            <div style="font-size: 13px; color: var(--muted);">${formattedDate} • ${summary}</div>
                        </a>`;
}

// Update writings.html with new article entry
function updateWritingsHtml(writingsContent, articleEntry) {
    // Find the 2026 section and add the new entry after the year header
    const yearHeaderPattern = /(<div\s+style="font-size: 13px; color: #e74c3c; margin-bottom: 15px; font-weight: 600; letter-spacing: 1px;">\s*2026<\/div>)/;

    if (writingsContent.match(yearHeaderPattern)) {
        // Add after the 2026 header
        return writingsContent.replace(
            yearHeaderPattern,
            `$1\n\n                        ${articleEntry}`
        );
    } else {
        // If no 2026 section exists, create one after the scrollable div opening
        const scrollableDivPattern = /<div style="max-height: 100%; overflow-y: auto; padding-right: 10px;">/;
        const newYearSection = `<div style="max-height: 100%; overflow-y: auto; padding-right: 10px;">

                    <!-- Year Group: 2026 -->
                    <div style="margin-bottom: 35px;">
                        <div
                            style="font-size: 13px; color: #e74c3c; margin-bottom: 15px; font-weight: 600; letter-spacing: 1px;">
                            2026</div>

                        ${articleEntry}
                    </div>`;
        return writingsContent.replace(scrollableDivPattern, newYearSection);
    }
}

// Commit files to GitHub
async function commitToGitHub(files, commitMessage) {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO_OWNER = 'stuart5915';
    const REPO_NAME = 'artstu-site';
    const BRANCH = 'main';

    if (!GITHUB_TOKEN) {
        throw new Error('GITHUB_TOKEN not configured');
    }

    const headers = {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
    };

    // Get the current commit SHA
    const refResponse = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/refs/heads/${BRANCH}`,
        { headers }
    );
    if (!refResponse.ok) {
        throw new Error(`Failed to get ref: ${await refResponse.text()}`);
    }
    const refData = await refResponse.json();
    const currentCommitSha = refData.object.sha;

    // Get the current tree
    const commitResponse = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/commits/${currentCommitSha}`,
        { headers }
    );
    if (!commitResponse.ok) {
        throw new Error(`Failed to get commit: ${await commitResponse.text()}`);
    }
    const commitData = await commitResponse.json();
    const baseTreeSha = commitData.tree.sha;

    // Create blobs for each file
    const treeItems = [];
    for (const file of files) {
        const blobResponse = await fetch(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/blobs`,
            {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    content: file.content,
                    encoding: 'utf-8'
                })
            }
        );
        if (!blobResponse.ok) {
            throw new Error(`Failed to create blob: ${await blobResponse.text()}`);
        }
        const blobData = await blobResponse.json();

        treeItems.push({
            path: file.path,
            mode: '100644',
            type: 'blob',
            sha: blobData.sha
        });
    }

    // Create new tree
    const treeResponse = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees`,
        {
            method: 'POST',
            headers,
            body: JSON.stringify({
                base_tree: baseTreeSha,
                tree: treeItems
            })
        }
    );
    if (!treeResponse.ok) {
        throw new Error(`Failed to create tree: ${await treeResponse.text()}`);
    }
    const treeData = await treeResponse.json();

    // Create commit
    const newCommitResponse = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/commits`,
        {
            method: 'POST',
            headers,
            body: JSON.stringify({
                message: commitMessage,
                tree: treeData.sha,
                parents: [currentCommitSha]
            })
        }
    );
    if (!newCommitResponse.ok) {
        throw new Error(`Failed to create commit: ${await newCommitResponse.text()}`);
    }
    const newCommitData = await newCommitResponse.json();

    // Update ref
    const updateRefResponse = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/refs/heads/${BRANCH}`,
        {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
                sha: newCommitData.sha
            })
        }
    );
    if (!updateRefResponse.ok) {
        throw new Error(`Failed to update ref: ${await updateRefResponse.text()}`);
    }

    return newCommitData.sha;
}

// Get file content from GitHub
async function getFileFromGitHub(path) {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO_OWNER = 'stuart5915';
    const REPO_NAME = 'artstu-site';

    const response = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
        {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        }
    );

    if (!response.ok) {
        if (response.status === 404) {
            return null;
        }
        throw new Error(`Failed to get file: ${await response.text()}`);
    }

    const data = await response.json();
    return Buffer.from(data.content, 'base64').toString('utf-8');
}

// Post to X/Twitter using API v2
async function postToX(text, url) {
    const X_API_KEY = process.env.X_API_KEY;
    const X_API_SECRET = process.env.X_API_SECRET;
    const X_ACCESS_TOKEN = process.env.X_ACCESS_TOKEN;
    const X_ACCESS_SECRET = process.env.X_ACCESS_SECRET;

    if (!X_API_KEY || !X_ACCESS_TOKEN) {
        console.log('X API credentials not configured, skipping tweet');
        return null;
    }

    try {
        // Create OAuth 1.0a signature
        const crypto = await import('crypto');
        const oauth_nonce = crypto.randomBytes(16).toString('hex');
        const oauth_timestamp = Math.floor(Date.now() / 1000).toString();

        const tweetText = url ? `${text}\n\n${url}` : text;

        // OAuth parameters
        const oauth_params = {
            oauth_consumer_key: X_API_KEY,
            oauth_token: X_ACCESS_TOKEN,
            oauth_signature_method: 'HMAC-SHA1',
            oauth_timestamp,
            oauth_nonce,
            oauth_version: '1.0'
        };

        // Create signature base string
        const method = 'POST';
        const base_url = 'https://api.twitter.com/2/tweets';

        const params_string = Object.keys(oauth_params)
            .sort()
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(oauth_params[key])}`)
            .join('&');

        const signature_base = `${method}&${encodeURIComponent(base_url)}&${encodeURIComponent(params_string)}`;
        const signing_key = `${encodeURIComponent(X_API_SECRET)}&${encodeURIComponent(X_ACCESS_SECRET)}`;

        const signature = crypto.createHmac('sha1', signing_key)
            .update(signature_base)
            .digest('base64');

        oauth_params.oauth_signature = signature;

        // Create Authorization header
        const auth_header = 'OAuth ' + Object.keys(oauth_params)
            .sort()
            .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauth_params[key])}"`)
            .join(', ');

        const response = await fetch('https://api.twitter.com/2/tweets', {
            method: 'POST',
            headers: {
                'Authorization': auth_header,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: tweetText })
        });

        if (!response.ok) {
            console.error('X API error:', await response.text());
            return null;
        }

        const data = await response.json();
        return {
            id: data.data.id,
            url: `https://twitter.com/artstu/status/${data.data.id}`
        };
    } catch (err) {
        console.error('Error posting to X:', err);
        return null;
    }
}

// Generate cover image using Gemini
async function generateCoverImage(title, summary) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        console.log('Gemini API key not configured, skipping image generation');
        return null;
    }

    // Note: Gemini doesn't directly generate images, but we can use it to create a prompt
    // for an image generation service, or return a placeholder
    // For now, we'll skip image generation and return null
    // In the future, this could integrate with DALL-E, Midjourney API, or Imagen

    console.log('Image generation not yet implemented');
    return null;
}

export default async function handler(req, res) {
    // CORS headers
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { title, summary, content, xPostText, generateImage, ideaId } = req.body;

        // Validation
        if (!title || title.trim().length < 3) {
            return res.status(400).json({ error: 'Title is required (min 3 characters)' });
        }

        if (!content || content.trim().length < 50) {
            return res.status(400).json({ error: 'Content is required (min 50 characters)' });
        }

        // Generate slug and date
        const slug = generateSlug(title);
        const now = new Date();
        const articleDate = now.toISOString();

        console.log(`Publishing article: ${title} (${slug})`);

        // Generate cover image if requested
        let coverImageUrl = null;
        if (generateImage) {
            coverImageUrl = await generateCoverImage(title, summary || title);
        }

        // Generate article HTML
        const articleHtml = generateArticleHtml(
            title,
            content,
            summary || title,
            coverImageUrl,
            articleDate
        );

        // Get current writings.html
        const writingsContent = await getFileFromGitHub('writings.html');
        if (!writingsContent) {
            return res.status(500).json({ error: 'Failed to fetch writings.html' });
        }

        // Generate article entry and update writings.html
        const articleEntry = generateArticleEntry(title, slug, summary || title, articleDate);
        const updatedWritings = updateWritingsHtml(writingsContent, articleEntry);

        // Commit to GitHub
        const files = [
            { path: `articles/${slug}.html`, content: articleHtml },
            { path: 'writings.html', content: updatedWritings }
        ];

        await commitToGitHub(files, `Add article: ${title}`);

        const articleUrl = `https://artstu.ca/articles/${slug}.html`;

        // Post to X/Twitter
        let tweetResult = null;
        if (xPostText && xPostText.trim()) {
            tweetResult = await postToX(xPostText.trim(), articleUrl);
        }

        // Log to Supabase for tracking (optional)
        try {
            await supabase.from('artstu_articles').insert({
                slug,
                title,
                summary: summary || title,
                content,
                idea_id: ideaId || null,
                published_at: articleDate,
                article_url: articleUrl,
                tweet_id: tweetResult?.id || null,
                tweet_url: tweetResult?.url || null
            });
        } catch (err) {
            // Don't fail if logging fails
            console.error('Failed to log article to Supabase:', err);
        }

        console.log(`Article published: ${articleUrl}`);

        return res.status(200).json({
            success: true,
            articleUrl,
            tweetUrl: tweetResult?.url || null,
            slug
        });

    } catch (error) {
        console.error('Publish article error:', error);
        return res.status(500).json({
            error: 'Failed to publish article',
            details: error.message
        });
    }
}
