// API endpoint to publish Proto Golf site changes via GitHub
// Called when Rachel clicks "Save & Publish" in the admin dashboard

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO_OWNER = 'stuart5915';
    const REPO_NAME = 'suitegpt'; // or 'stuart-hollinger-landing' if that's the actual name
    const BRANCH = 'master';

    if (!GITHUB_TOKEN) {
        return res.status(500).json({ error: 'GitHub token not configured' });
    }

    try {
        const { page, html, requestText } = req.body;

        if (!page || !html) {
            return res.status(400).json({ error: 'Page and HTML are required' });
        }

        // Whitelist of allowed pages - SECURITY: only these can be modified
        const ALLOWED_PAGES = [
            'index.html',
            'shop.html',
            'about.html',
            'contact.html',
            'faq.html',
            'limited.html',
            'checkout.html',
            'products/product.html',
            'products/rough-mill.html',
            'products/centre-blade.html',
            'products/long-neck-blade.html'
        ];

        // Normalize page path
        const normalizedPage = page.replace(/^\.\.\//, '').replace(/^\//, '');

        if (!ALLOWED_PAGES.includes(normalizedPage)) {
            return res.status(403).json({ error: 'Page not in whitelist' });
        }

        const filePath = `proto-golf-site/${normalizedPage}`;

        // Get current file SHA (required for updates)
        const getFileResponse = await fetch(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}?ref=${BRANCH}`,
            {
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'ProtoGolf-SiteEditor'
                }
            }
        );

        if (!getFileResponse.ok && getFileResponse.status !== 404) {
            const err = await getFileResponse.json();
            console.error('GitHub get file error:', err);
            return res.status(500).json({ error: 'Failed to get current file from GitHub' });
        }

        const fileData = getFileResponse.status === 404 ? null : await getFileResponse.json();
        const currentSha = fileData?.sha;

        // Commit the new content
        const commitMessage = `[Proto Golf Editor] Update ${normalizedPage}\n\nChange: ${requestText || 'Site edit'}\n\nPublished by Rachel via Admin Dashboard`;

        const updateResponse = await fetch(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'ProtoGolf-SiteEditor'
                },
                body: JSON.stringify({
                    message: commitMessage,
                    content: Buffer.from(html).toString('base64'),
                    sha: currentSha,
                    branch: BRANCH
                })
            }
        );

        if (!updateResponse.ok) {
            const err = await updateResponse.json();
            console.error('GitHub commit error:', err);
            return res.status(500).json({ error: 'Failed to commit to GitHub', details: err.message });
        }

        const result = await updateResponse.json();

        return res.status(200).json({
            success: true,
            message: 'Published successfully! Changes will be live in ~30 seconds.',
            commitUrl: result.commit?.html_url,
            commitSha: result.commit?.sha
        });

    } catch (error) {
        console.error('Publish error:', error);
        return res.status(500).json({ error: 'Failed to publish', details: error.message });
    }
}
