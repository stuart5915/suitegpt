import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'ethers';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rdsmdywbdiskxknluiym.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { address, message, signature } = req.body;
  if (!address || !message || !signature) {
    return res.status(400).json({ error: 'Missing address, message, or signature' });
  }

  // Verify the signature matches the claimed address
  let recoveredAddress;
  try {
    recoveredAddress = verifyMessage(message, signature).toLowerCase();
  } catch {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  if (recoveredAddress !== address.toLowerCase()) {
    return res.status(400).json({ error: 'Signature does not match address' });
  }

  if (!SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Auth not configured' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

    // Use short hash of address for email (Supabase rejects long emails)
  const shortAddr = address.toLowerCase().slice(2, 12);
  const walletEmail = `${shortAddr}@j4c.wallet`;
  const walletPass = `w4ll3t_${address.toLowerCase()}_j4c`;

  try {
    // Try to find existing user by email
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(u => u.email === walletEmail);

    let userId;

    if (existing) {
      userId = existing.id;
    } else {
      // Create new user (skip email confirmation)
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: walletEmail,
        password: walletPass,
        email_confirm: true,
        user_metadata: { wallet_address: address.toLowerCase() }
      });

      if (createErr) {
        return res.status(500).json({ error: 'Failed to create account: ' + createErr.message });
      }
      userId = newUser.user.id;
    }

    // Generate a session for the user
    const { data: session, error: signInErr } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: walletEmail
    });

    // Sign in with password instead (more reliable)
    // First update password to ensure it matches
    await supabase.auth.admin.updateUser(userId, { password: walletPass });

    return res.status(200).json({
      success: true,
      email: walletEmail,
      password: walletPass,
      user_id: userId,
      is_new: !existing
    });
  } catch (err) {
    return res.status(500).json({ error: 'Auth failed: ' + (err.message || String(err)) });
  }
}
