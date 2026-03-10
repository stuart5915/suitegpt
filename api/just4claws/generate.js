const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_J4C_ENDPOINT_ID;

const BLOCKED_TERMS = [
  'child', 'minor', 'underage', 'kid', 'teen', 'preteen',
  'infant', 'baby', 'toddler', 'young girl', 'young boy',
  'loli', 'shota', 'school girl', 'schoolgirl'
];

function isPromptSafe(prompt) {
  const lower = prompt.toLowerCase();
  return !BLOCKED_TERMS.some(term => lower.includes(term));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, style } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
  if (!isPromptSafe(prompt)) return res.status(400).json({ error: 'Prompt contains prohibited content.' });
  if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_ID) return res.status(500).json({ error: 'RunPod not configured.' });

  const styleModifiers = {
    realistic: 'photorealistic, high detail, cinematic lighting, 8k',
    anime: 'anime style, vibrant colors, detailed illustration',
    fantasy: 'fantasy art, ethereal, magical, detailed digital painting',
    artistic: 'artistic, oil painting style, dramatic lighting, masterpiece',
    cyberpunk: 'cyberpunk aesthetic, neon lights, futuristic, high tech'
  };

  const enhancedPrompt = `${prompt}, ${styleModifiers[style] || styleModifiers.realistic}, beautiful, high quality`;

  try {
    // SDXL Turbo — async /run (cold start may take 30-60s first time)
    const runRes = await fetch(`https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RUNPOD_API_KEY}`
      },
      body: JSON.stringify({
        input: {
          prompt: enhancedPrompt,
          negative_prompt: 'child, minor, underage, low quality, blurry, deformed, ugly, disfigured, extra limbs',
          width: 1024,
          height: 1024,
          num_inference_steps: 4,
          guidance_scale: 0.0,
          seed: Math.floor(Math.random() * 2147483647),
          num_images: 1
        }
      })
    });

    if (!runRes.ok) {
      const errText = await runRes.text();
      return res.status(500).json({ error: `RunPod error (${runRes.status}): ${errText.slice(0, 200)}` });
    }

    const runData = await runRes.json();
    return res.status(200).json({ job_id: runData.id, status: runData.status });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to submit: ' + (err.message || String(err)) });
  }
}
