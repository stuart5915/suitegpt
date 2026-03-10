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

const MODELS = {
  flux: { endpoint: 'https://modelslab.com/api/v6/images/text2img', model_id: 'flux', width: 1024, height: 1024, steps: 20, guidance: 3.5, credits: 3 },
  sdxl: { endpoint: 'https://modelslab.com/api/v6/realtime/text2img', model_id: null, width: 512, height: 768, steps: null, guidance: null, credits: 1 }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, style, model } = req.body;
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

  const chosen = MODELS[model] || MODELS.sdxl;
  const enhancedPrompt = `1 person solo, ${prompt}, ${styleModifiers[style] || styleModifiers.realistic}, beautiful, high quality`;

  try {
    const body = {
      key: MODELSLAB_KEY,
      prompt: enhancedPrompt,
      negative_prompt: '2 people, multiple people, child, minor, underage, low quality, blurry, deformed, ugly, disfigured, extra limbs, bad anatomy, bad hands, missing fingers, cropped, worst quality, cross eyed',
      width: chosen.width,
      height: chosen.height,
      samples: 1,
      safety_checker: 'no',
      enhance_prompt: 'no',
      seed: null
    };

    // FLUX uses community models endpoint with model_id + extra params
    if (chosen.model_id) {
      body.model_id = chosen.model_id;
      body.num_inference_steps = chosen.steps;
      body.guidance_scale = chosen.guidance;
    }

    const apiRes = await fetch(chosen.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await apiRes.json();

    if (data.status === 'error') {
      return res.status(500).json({ error: data.message || data.messege || 'Generation failed' });
    }

    if (data.status === 'success' && data.output?.[0]) {
      return res.status(200).json({ status: 'COMPLETED', image_url: data.output[0], credits: chosen.credits });
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
