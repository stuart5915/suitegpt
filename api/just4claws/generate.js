const { createClient } = require('@supabase/supabase-js');

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_J4C_ENDPOINT_ID;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bxpfkuqgsypjfcdnoohs.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Blocked terms for prompt safety
const BLOCKED_TERMS = [
  'child', 'minor', 'underage', 'kid', 'teen', 'preteen',
  'infant', 'baby', 'toddler', 'young girl', 'young boy',
  'loli', 'shota', 'school girl', 'schoolgirl'
];

function isPromptSafe(prompt) {
  const lower = prompt.toLowerCase();
  return !BLOCKED_TERMS.some(term => lower.includes(term));
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, style, model, user_id } = req.body;

  if (!prompt || !user_id) {
    return res.status(400).json({ error: 'Prompt and user_id are required' });
  }

  // Safety filter
  if (!isPromptSafe(prompt)) {
    return res.status(400).json({ error: 'Prompt contains prohibited content. Only adult characters are allowed.' });
  }

  if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_ID) {
    return res.status(500).json({ error: 'Image generation not configured yet. Add RunPod billing first.' });
  }

  // Build enhanced prompt based on style
  const styleModifiers = {
    realistic: 'photorealistic, high detail, cinematic lighting, 8k',
    anime: 'anime style, vibrant colors, detailed illustration',
    fantasy: 'fantasy art, ethereal, magical, detailed digital painting',
    artistic: 'artistic, oil painting style, dramatic lighting, masterpiece',
    cyberpunk: 'cyberpunk aesthetic, neon lights, futuristic, high tech'
  };

  const enhancedPrompt = `${prompt}, ${styleModifiers[style] || styleModifiers.realistic}, beautiful, high quality`;

  try {
    // Submit job to RunPod
    const runRes = await fetch(`https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/runsync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RUNPOD_API_KEY}`
      },
      body: JSON.stringify({
        input: {
          prompt: enhancedPrompt,
          negative_prompt: 'child, minor, underage, low quality, blurry, deformed, ugly, disfigured',
          width: 1024,
          height: 1024,
          num_inference_steps: 30,
          guidance_scale: 7.5,
          seed: Math.floor(Math.random() * 2147483647)
        }
      })
    });

    const runData = await runRes.json();

    if (runData.status === 'FAILED') {
      return res.status(500).json({ error: 'Image generation failed. Try again.' });
    }

    // RunPod returns base64 image or URL depending on worker config
    let imageUrl = null;

    if (runData.output?.image_url) {
      imageUrl = runData.output.image_url;
    } else if (runData.output?.images?.[0]) {
      // If base64, upload to Supabase Storage
      const base64 = runData.output.images[0];
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const fileName = `generated/${user_id}/${Date.now()}.png`;
      const buffer = Buffer.from(base64, 'base64');

      const { data: upload, error: uploadErr } = await supabase.storage
        .from('j4c-content')
        .upload(fileName, buffer, { contentType: 'image/png', upsert: false });

      if (uploadErr) {
        return res.status(500).json({ error: 'Failed to save generated image' });
      }

      const { data: urlData } = supabase.storage.from('j4c-content').getPublicUrl(fileName);
      imageUrl = urlData.publicUrl;
    } else if (runData.output?.message) {
      return res.status(500).json({ error: runData.output.message });
    } else {
      return res.status(500).json({ error: 'Unexpected response from image generator' });
    }

    // Track generation in DB
    if (SUPABASE_SERVICE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      await supabase.from('j4c_transactions').insert({
        user_id,
        type: 'generation',
        amount: 0,
        metadata: { prompt, style, model: model || 'flux' }
      }).catch(() => {}); // non-critical
    }

    return res.status(200).json({ image_url: imageUrl });
  } catch (err) {
    console.error('Generation error:', err);
    return res.status(500).json({ error: 'Image generation failed. Please try again.' });
  }
};
