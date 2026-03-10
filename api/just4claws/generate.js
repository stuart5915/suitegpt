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

  const styleModifiers = {
    realistic: 'photorealistic, high detail, cinematic lighting, 8k',
    anime: 'anime style, vibrant colors, detailed illustration',
    fantasy: 'fantasy art, ethereal, magical, detailed digital painting',
    artistic: 'artistic, oil painting style, dramatic lighting, masterpiece',
    cyberpunk: 'cyberpunk aesthetic, neon lights, futuristic, high tech'
  };

  const enhancedPrompt = `${prompt}, ${styleModifiers[style] || styleModifiers.realistic}, beautiful, high quality`;
  const seed = Math.floor(Math.random() * 2147483647);

  // Pollinations AI — free Flux image generation, no API key needed
  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&seed=${seed}&model=flux&nologo=true`;

  return res.status(200).json({ image_url: imageUrl });
}
