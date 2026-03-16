import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET — list mirror vaults (with sorting, filtering)
    if (req.method === 'GET') {
      const { sort = 'tvl', order = 'desc', creator, limit = 50 } = req.query;

      const sortCol = sort === 'apy' ? 'estimated_apy'
                    : sort === 'tvl' ? 'tvl_usdc'
                    : sort === 'staked' ? 'basis_staked'
                    : sort === 'newest' ? 'created_at'
                    : sort === 'return7d' ? 'return_7d'
                    : sort === 'return30d' ? 'return_30d'
                    : 'tvl_usdc';

      let query = supabase
        .from('mirror_vault_marketplace')
        .select('*')
        .eq('is_active', true)
        .order(sortCol, { ascending: order === 'asc' })
        .limit(parseInt(limit));

      if (creator) {
        query = query.eq('creator_address', creator.toLowerCase());
      }

      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json({ vaults: data });
    }

    // POST — register a new mirror vault (called after on-chain createVault)
    if (req.method === 'POST') {
      const {
        vault_address,
        creator_address,
        name,
        description,
        performance_fee_bps,
        deposit_cap_usdc,
        tracked_wallet,
        tracked_token_id,
        basis_burned
      } = req.body;

      if (!vault_address || !creator_address) {
        return res.status(400).json({ error: 'vault_address and creator_address required' });
      }

      const { data, error } = await supabase
        .from('mirror_vault_marketplace')
        .upsert({
          vault_address: vault_address.toLowerCase(),
          creator_address: creator_address.toLowerCase(),
          name: name || 'Unnamed Mirror Vault',
          description: description || '',
          performance_fee_bps: performance_fee_bps || 0,
          deposit_cap_usdc: deposit_cap_usdc || 0,
          tracked_wallet: (tracked_wallet || '').toLowerCase(),
          tracked_token_id: tracked_token_id || '0',
          basis_burned: basis_burned || 0,
          updated_at: new Date().toISOString()
        }, { onConflict: 'vault_address' })
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ vault: data });
    }

    // PUT — update cached metrics (called by keeper) or vault config
    if (req.method === 'PUT') {
      const { vault_address, _snapshot, ...updates } = req.body;
      if (!vault_address) {
        return res.status(400).json({ error: 'vault_address required' });
      }

      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('mirror_vault_marketplace')
        .update(updates)
        .eq('vault_address', vault_address.toLowerCase())
        .select()
        .single();

      if (error) throw error;

      // If _snapshot flag is set, also save a snapshot for performance charts
      if (_snapshot) {
        await supabase.from('mirror_vault_snapshots').insert({
          vault_address: vault_address.toLowerCase(),
          tvl_usdc: updates.tvl_usdc || data.tvl_usdc || 0,
          share_price: updates.share_price || data.share_price || 1.0,
          is_in_range: updates.is_in_range != null ? updates.is_in_range : data.is_in_range,
          eth_price: updates.eth_price || 0,
          tick_lower: updates.tracked_position_tick_lower || data.tracked_position_tick_lower || 0,
          tick_upper: updates.tracked_position_tick_upper || data.tracked_position_tick_upper || 0
        });
      }

      return res.status(200).json({ vault: data });
    }

    // DELETE — soft-delete a vault (creator or admin only)
    if (req.method === 'DELETE') {
      const { vault_address, wallet_address } = req.body;
      if (!vault_address || !wallet_address) {
        return res.status(400).json({ error: 'vault_address and wallet_address required' });
      }

      const ADMIN_WALLET = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';
      const wallet = wallet_address.toLowerCase();

      // Verify caller is creator or admin
      const { data: vault, error: fetchErr } = await supabase
        .from('mirror_vault_marketplace')
        .select('creator_address')
        .eq('vault_address', vault_address.toLowerCase())
        .single();

      if (fetchErr) throw fetchErr;
      if (!vault) return res.status(404).json({ error: 'vault not found' });

      if (vault.creator_address !== wallet && wallet !== ADMIN_WALLET) {
        return res.status(403).json({ error: 'not authorized' });
      }

      const { error: delErr } = await supabase
        .from('mirror_vault_marketplace')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('vault_address', vault_address.toLowerCase());

      if (delErr) throw delErr;
      return res.status(200).json({ ok: true, deleted: vault_address });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Mirror marketplace API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
