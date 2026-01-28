// LinkedIn OAuth Callback - captures the authorization code
export default async function handler(req, res) {
    const { code, error, error_description } = req.query;

    if (error) {
        return res.status(400).send(`
            <html>
            <head><title>LinkedIn Auth Error</title></head>
            <body style="font-family: system-ui; padding: 40px; background: #1a1a2e; color: #f5f5f7;">
                <h1>❌ LinkedIn Authorization Error</h1>
                <p><strong>Error:</strong> ${error}</p>
                <p><strong>Description:</strong> ${error_description || 'No description'}</p>
                <p><a href="https://suitegpt.app/governance" style="color: #ff8c42;">← Back to SUITE</a></p>
            </body>
            </html>
        `);
    }

    if (!code) {
        return res.status(400).send(`
            <html>
            <head><title>LinkedIn Auth</title></head>
            <body style="font-family: system-ui; padding: 40px; background: #1a1a2e; color: #f5f5f7;">
                <h1>⚠️ No Authorization Code</h1>
                <p>No code was received from LinkedIn.</p>
                <p><a href="https://suitegpt.app/governance" style="color: #ff8c42;">← Back to SUITE</a></p>
            </body>
            </html>
        `);
    }

    // Display the code for manual token exchange
    return res.status(200).send(`
        <html>
        <head><title>LinkedIn Auth Success</title></head>
        <body style="font-family: system-ui; padding: 40px; background: #1a1a2e; color: #f5f5f7; max-width: 600px;">
            <h1>✅ LinkedIn Authorization Success!</h1>
            <p>Copy this authorization code:</p>
            <div style="background: #12121f; padding: 16px; border-radius: 8px; word-break: break-all; font-family: monospace; margin: 20px 0;">
                ${code}
            </div>
            <p style="color: #a0a0a0;">This code expires in a few minutes. Send it to Claude to exchange for an access token.</p>
            <p><a href="https://suitegpt.app/governance" style="color: #ff8c42;">← Back to SUITE</a></p>
        </body>
        </html>
    `);
}
