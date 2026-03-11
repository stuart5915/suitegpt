const MODELSLAB_KEY = process.env.MODELSLAB_API_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const fetchUrl = req.query.fetch_url;
  if (!fetchUrl) return res.status(400).json({ error: 'fetch_url required' });

  try {
    const statusRes = await fetch(fetchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: MODELSLAB_KEY })
    });

    const data = await statusRes.json();

    if (data.status === 'success' && (data.output?.[0] || data.proxy_links?.[0])) {
      const imageUrl = data.output?.[0]?.includes('s3.amazonaws.com')
        ? data.output[0]
        : (data.proxy_links?.[0] || data.output?.[0]);
      return res.status(200).json({ status: 'COMPLETED', image_url: imageUrl });
    }

    if (data.status === 'processing') {
      return res.status(200).json({ status: 'PROCESSING' });
    }

    if (data.status === 'error') {
      return res.status(200).json({ status: 'FAILED', error: data.message || 'Generation failed' });
    }

    return res.status(200).json({ status: 'PROCESSING' });
  } catch (err) {
    return res.status(500).json({ error: 'Status check failed: ' + (err.message || String(err)) });
  }
}
