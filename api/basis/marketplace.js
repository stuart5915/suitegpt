import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET — list all vaults (with optional sorting)
    if (req.method === 'GET') {
      const { sort = 'apy', order = 'desc', manager, limit = 50 } = req.query;

      const sortCol = sort === 'apy' ? 'estimated_apy'
                    : sort === 'return' ? 'total_return_pct'
                    : sort === 'newest' ? 'created_at'
                    : sort === 'active' ? 'rebalance_count'
                    : 'tvl_usdc';

      let query = supabase
        .from('vault_marketplace')
        .select('*')
        .eq('is_active', true)
        .order(sortCol, { ascending: order === 'asc' })
        .limit(parseInt(limit));

      if (manager) {
        query = query.eq('manager_address', manager.toLowerCase());
      }

      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json({ vaults: data });
    }

    // POST — register a new vault (called after on-chain createVault)
    if (req.method === 'POST') {
      const {
        vault_address,
        manager_address,
        name,
        description,
        brain_config,
        config_hash,
        performance_fee_bps,
        deposit_cap_usdc,
        manager_name
      } = req.body;

      if (!vault_address || !manager_address) {
        return res.status(400).json({ error: 'vault_address and manager_address required' });
      }

      const { data, error } = await supabase
        .from('vault_marketplace')
        .upsert({
          vault_address: vault_address.toLowerCase(),
          manager_address: manager_address.toLowerCase(),
          name: name || 'Unnamed Vault',
          description: description || '',
          brain_config: brain_config || {},
          config_hash: config_hash || '',
          performance_fee_bps: performance_fee_bps || 0,
          deposit_cap_usdc: deposit_cap_usdc || 0,
          manager_name: manager_name || 'Anonymous',
          updated_at: new Date().toISOString()
        }, { onConflict: 'vault_address' })
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ vault: data });
    }

    // PUT — update vault config (called by manager dashboard) or metrics (called by keeper)
    if (req.method === 'PUT') {
      const { vault_address, _log_change, _change_type, _old_value, _note, ...updates } = req.body;
      if (!vault_address) {
        return res.status(400).json({ error: 'vault_address required' });
      }

      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('vault_marketplace')
        .update(updates)
        .eq('vault_address', vault_address.toLowerCase())
        .select()
        .single();

      if (error) throw error;

      // Log the config change if requested
      if (_log_change && _change_type) {
        await supabase.from('vault_config_log').insert({
          vault_address: vault_address.toLowerCase(),
          changed_by: (updates.manager_address || data.manager_address || '').toLowerCase(),
          change_type: _change_type,
          old_value: _old_value || {},
          new_value: updates.brain_config || updates,
          note: _note || ''
        });
      }

      return res.status(200).json({ vault: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Marketplace API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
