const MODELSLAB_KEY = process.env.MODELSLAB_API_KEY;

const BLOCKED_TERMS = [
  'child', 'minor', 'underage', 'kid', 'teen', 'preteen',
  'infant', 'baby', 'toddler', 'young girl', 'young boy',
  'loli', 'shota', 'school girl', 'schoolgirl'
];

function isPromptSafe(prompt) {
  const lower = prompt.toLowerCase();
  return !BLOCKED_TERMS.some(term => lower.includes(term));
}

// FLUX = artistic/soft nudes (censors hardcore)
// Uncensored SD models = full explicit hardcore
const MODELS = {
  fast:    { model_id: 'flux', width: 768, height: 768, steps: 8, guidance: 3.5, credits: 1 },
  flux:    { model_id: 'flux', width: 1024, height: 1024, steps: 20, guidance: 3.5, credits: 3 },
  xxx:     { model_id: 'realistic-vision-v51', width: 512, height: 768, steps: 30, guidance: 7.5, credits: 2 },
  xxxhd:   { model_id: 'absolutereality-v181', width: 512, height: 768, steps: 35, guidance: 7.5, credits: 3 },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, style, model, explicit } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
  if (!isPromptSafe(prompt)) return res.status(400).json({ error: 'Prompt contains prohibited content.' });
  if (!MODELSLAB_KEY) return res.status(500).json({ error: 'Image API not configured.' });

  const styleModifiers = {
    realistic: 'photorealistic, high detail, cinematic lighting, 8k',
    anime: 'anime style, vibrant colors, detailed illustration',
    fantasy: 'fantasy art, ethereal, magical, detailed digital painting',
    artistic: 'artistic, oil painting style, dramatic lighting, masterpiece',
    cyberpunk: 'cyberpunk aesthetic, neon lights, futuristic, high tech'
  };

  // If explicit mode on, override to uncensored model
  let chosen;
  if (explicit) {
    chosen = (model === 'xxxhd' || model === 'flux') ? MODELS.xxxhd : MODELS.xxx;
  } else {
    chosen = MODELS[model] || MODELS.fast;
  }

  let enhancedPrompt;
  if (explicit) {
    enhancedPrompt = `(nsfw:1.4), (explicit:1.3), (nude:1.3), ${prompt}, ${styleModifiers[style] || styleModifiers.realistic}, masterpiece, best quality, detailed body, anatomically correct, sharp focus`;
  } else {
    enhancedPrompt = `${prompt}, ${styleModifiers[style] || styleModifiers.realistic}, beautiful, high quality`;
  }

  try {
    const body = {
      key: MODELSLAB_KEY,
      model_id: chosen.model_id,
      prompt: enhancedPrompt,
      negative_prompt: 'child, minor, underage, low quality, blurry, deformed, ugly, disfigured, extra limbs, bad anatomy, bad hands, missing fingers, cropped, worst quality, cross eyed, extra fingers, mutated hands',
      width: chosen.width,
      height: chosen.height,
      samples: 1,
      num_inference_steps: chosen.steps,
      guidance_scale: chosen.guidance,
      safety_checker: 'no',
      enhance_prompt: 'no',
      seed: null
    };

    const apiRes = await fetch('https://modelslab.com/api/v6/images/text2img', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await apiRes.json();

    if (data.status === 'error') {
      return res.status(500).json({ error: data.message || data.messege || 'Generation failed' });
    }

    const imageUrl = data.output?.[0] || data.proxy_links?.[0];

    if (data.status === 'success' && imageUrl) {
      return res.status(200).json({ status: 'COMPLETED', image_url: imageUrl, credits: chosen.credits });
    }

    if (data.status === 'processing') {
      return res.status(200).json({
        status: 'PROCESSING',
        fetch_url: data.fetch_result,
        job_id: data.id,
        eta: data.eta || 10,
        credits: chosen.credits
      });
    }

    return res.status(500).json({ error: 'Unexpected response: ' + JSON.stringify(data).slice(0, 200) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to submit: ' + (err.message || String(err)) });
  }
}
