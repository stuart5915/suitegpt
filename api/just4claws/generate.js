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

// Build ComfyUI workflow for SDXL
function buildWorkflow(prompt, negativePrompt, seed) {
  return {
    "3": {
      "class_type": "KSampler",
      "inputs": {
        "cfg": 7.5,
        "denoise": 1,
        "latent_image": ["5", 0],
        "model": ["4", 0],
        "negative": ["7", 0],
        "positive": ["6", 0],
        "sampler_name": "euler_ancestral",
        "scheduler": "normal",
        "seed": seed,
        "steps": 30
      }
    },
    "4": {
      "class_type": "CheckpointLoaderSimple",
      "inputs": {
        "ckpt_name": "sd_xl_base_1.0.safetensors"
      }
    },
    "5": {
      "class_type": "EmptyLatentImage",
      "inputs": {
        "batch_size": 1,
        "height": 1024,
        "width": 1024
      }
    },
    "6": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "clip": ["4", 1],
        "text": prompt
      }
    },
    "7": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "clip": ["4", 1],
        "text": negativePrompt
      }
    },
    "8": {
      "class_type": "VAEDecode",
      "inputs": {
        "samples": ["3", 0],
        "vae": ["4", 2]
      }
    },
    "9": {
      "class_type": "SaveImage",
      "inputs": {
        "filename_prefix": "J4C",
        "images": ["8", 0]
      }
    }
  };
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
  const negativePrompt = 'child, minor, underage, low quality, blurry, deformed, ugly, disfigured, extra limbs';
  const seed = Math.floor(Math.random() * 2147483647);

  try {
    const workflow = buildWorkflow(enhancedPrompt, negativePrompt, seed);

    const runRes = await fetch(`https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RUNPOD_API_KEY}`
      },
      body: JSON.stringify({ input: { workflow } })
    });

    if (!runRes.ok) {
      const errText = await runRes.text();
      return res.status(500).json({ error: `RunPod error (${runRes.status}): ${errText.slice(0, 200)}` });
    }

    const runData = await runRes.json();
    return res.status(200).json({ job_id: runData.id, status: runData.status });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to submit job: ' + (err.message || String(err)) });
  }
}
