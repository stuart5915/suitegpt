import { createClient } from '@supabase/supabase-js';

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_J4C_ENDPOINT_ID;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rdsmdywbdiskxknluiym.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const jobId = req.query.id;
  if (!jobId) return res.status(400).json({ error: 'Job ID required' });

  try {
    const statusRes = await fetch(`https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/status/${jobId}`, {
      headers: { 'Authorization': `Bearer ${RUNPOD_API_KEY}` }
    });

    if (!statusRes.ok) {
      const errText = await statusRes.text();
      return res.status(500).json({ error: `RunPod status error: ${errText.slice(0, 200)}` });
    }

    const data = await statusRes.json();

    // Still working
    if (data.status === 'IN_QUEUE' || data.status === 'IN_PROGRESS') {
      return res.status(200).json({ status: data.status });
    }

    // Failed
    if (data.status === 'FAILED') {
      return res.status(200).json({ status: 'FAILED', error: data.error || 'Generation failed' });
    }

    // Completed — extract image
    let imageUrl = null;

    if (data.output?.image_url) {
      imageUrl = data.output.image_url;
    } else if (data.output?.image) {
      imageUrl = await uploadBase64(data.output.image, req.query.uid);
    } else if (data.output?.images?.[0]) {
      imageUrl = await uploadBase64(data.output.images[0], req.query.uid);
    } else {
      return res.status(200).json({ status: 'COMPLETED', error: 'No image in response: ' + JSON.stringify(data.output || {}).slice(0, 200) });
    }

    return res.status(200).json({ status: 'COMPLETED', image_url: imageUrl });
  } catch (err) {
    return res.status(500).json({ error: 'Status check failed: ' + (err.message || String(err)) });
  }
}

async function uploadBase64(base64, userId) {
  if (!SUPABASE_SERVICE_KEY) throw new Error('Storage not configured');
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const fileName = `generated/${userId || 'anon'}/${Date.now()}.png`;
  const buffer = Buffer.from(base64, 'base64');

  const { error } = await supabase.storage
    .from('j4c-content')
    .upload(fileName, buffer, { contentType: 'image/png', upsert: false });

  if (error) throw new Error('Upload failed: ' + error.message);

  const { data } = supabase.storage.from('j4c-content').getPublicUrl(fileName);
  return data.publicUrl;
}
