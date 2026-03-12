import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const { vault_address, limit = 50 } = req.query;
  if (!vault_address) return res.status(400).json({ error: 'vault_address required' });

  try {
    const { data, error } = await supabase
      .from('vault_config_log')
      .select('*')
      .eq('vault_address', vault_address.toLowerCase())
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (error) throw error;
    return res.status(200).json({ logs: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
