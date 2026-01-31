// Email notification when a new client lead submits the form
// Called from client-landing/index.html after Supabase insert

import { Resend } from 'resend';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
        console.error('RESEND_API_KEY not configured');
        return res.status(500).json({ error: 'Email not configured' });
    }

    try {
        const { name, email, phone, business_name, business_type, message, source, ad_id } = req.body;

        const resend = new Resend(resendKey);

        const emailBody = `
<h2>New Client Lead</h2>
<table style="border-collapse:collapse;width:100%;max-width:500px;font-family:sans-serif;">
  <tr><td style="padding:8px 12px;font-weight:bold;color:#555;border-bottom:1px solid #eee;">Name</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${name || '—'}</td></tr>
  <tr><td style="padding:8px 12px;font-weight:bold;color:#555;border-bottom:1px solid #eee;">Email</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${email || '—'}</td></tr>
  <tr><td style="padding:8px 12px;font-weight:bold;color:#555;border-bottom:1px solid #eee;">Phone</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${phone || '—'}</td></tr>
  <tr><td style="padding:8px 12px;font-weight:bold;color:#555;border-bottom:1px solid #eee;">Business</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${business_name || '—'}</td></tr>
  <tr><td style="padding:8px 12px;font-weight:bold;color:#555;border-bottom:1px solid #eee;">Type</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${business_type || '—'}</td></tr>
  <tr><td style="padding:8px 12px;font-weight:bold;color:#555;border-bottom:1px solid #eee;">Source</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${source || 'direct'}${ad_id ? ' (ad: ' + ad_id + ')' : ''}</td></tr>
  <tr><td style="padding:8px 12px;font-weight:bold;color:#555;">What They Need</td><td style="padding:8px 12px;">${message || '—'}</td></tr>
</table>
<p style="margin-top:16px;font-size:13px;color:#999;">View all leads: <a href="https://suitegpt.app">SuiteGPT</a> → Factory → Clients → Ads & Leads</p>
`;

        const { data, error } = await resend.emails.send({
            from: 'SUITE Clients <leads@suitegpt.app>',
            to: ['stuart@suitegpt.app'],
            subject: `New Lead: ${business_name || name || 'Unknown'} (${source || 'direct'})`,
            html: emailBody,
        });

        if (error) {
            console.error('Resend error:', error);
            return res.status(500).json({ error: 'Failed to send email' });
        }

        return res.status(200).json({ ok: true, emailId: data?.id });
    } catch (err) {
        console.error('notify-lead error:', err);
        return res.status(500).json({ error: err.message });
    }
}
