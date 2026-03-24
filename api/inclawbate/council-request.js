// Council Request API — create, poll, and reply to council requests
// POST: create or reply to a request
// GET: poll for new messages on a request

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || 'https://inclawbate.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — poll for messages on a request
  if (req.method === 'GET') {
    const { id, session_id } = req.query;
    if (!id && !session_id) return res.status(400).json({ error: 'id or session_id required' });

    let query = supabase.from('council_requests').select('*');
    if (id) query = query.eq('id', id);
    else query = query.eq('session_id', session_id).order('created_at', { ascending: false }).limit(1);

    const { data, error } = await query.maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.json({ request: null });

    return res.json({ request: data });
  }

  // POST — create or reply
  if (req.method === 'POST') {
    const { action, id, session_id, contact, description, message, name, wallet } = req.body || {};

    // Create a new council request
    if (action === 'create') {
      if (!session_id || !contact || !description) {
        return res.status(400).json({ error: 'session_id, contact, and description required' });
      }

      // Check if this session already has an open request
      const { data: existing } = await supabase
        .from('council_requests')
        .select('id')
        .eq('session_id', session_id)
        .in('status', ['open', 'in_progress'])
        .maybeSingle();

      if (existing) {
        return res.json({ request_id: existing.id, existing: true, message: 'You already have an open request.' });
      }

      const messages = [{
        role: 'user',
        text: description,
        at: new Date().toISOString()
      }];

      const { data, error } = await supabase
        .from('council_requests')
        .insert({
          session_id,
          contact,
          description,
          messages,
          wallet: wallet || null,
          status: 'open'
        })
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });

      // Also post to TG council group via hire-request API
      try {
        await fetch('https://www.inclawbate.app/api/inclawbate/hire-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: `[Council Request #${data.id.slice(0, 8)}]\n\n${description}\n\nContact: ${contact}`,
            contact,
            budget_claws: 0,
            request_id: data.id
          })
        });
      } catch (_) { /* TG post failed, request still saved */ }

      return res.json({
        request_id: data.id,
        message: 'Request sent to the Council! They can reach you at ' + contact + '. Stay here for live replies or check back anytime.'
      });
    }

    // Add a message to an existing request (from council via TG webhook or from user)
    if (action === 'reply') {
      if (!id || !message) return res.status(400).json({ error: 'id and message required' });

      const { data: request } = await supabase
        .from('council_requests')
        .select('messages')
        .eq('id', id)
        .single();

      if (!request) return res.status(404).json({ error: 'Request not found' });

      const msgs = request.messages || [];
      msgs.push({
        role: name ? 'council' : 'user',
        name: name || null,
        text: message,
        at: new Date().toISOString()
      });

      const { error } = await supabase
        .from('council_requests')
        .update({ messages: msgs, status: 'in_progress', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true });
    }

    // User sends a follow-up message
    if (action === 'user_reply') {
      if (!id || !message) return res.status(400).json({ error: 'id and message required' });

      const { data: request } = await supabase
        .from('council_requests')
        .select('messages, contact')
        .eq('id', id)
        .single();

      if (!request) return res.status(404).json({ error: 'Request not found' });

      const msgs = request.messages || [];
      msgs.push({
        role: 'user',
        text: message,
        at: new Date().toISOString()
      });

      const { error } = await supabase
        .from('council_requests')
        .update({ messages: msgs, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) return res.status(500).json({ error: error.message });

      // Forward to TG council group
      try {
        await fetch('https://www.inclawbate.app/api/inclawbate/hire-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: `[Follow-up on #${id.slice(0, 8)}]\n\n${message}\n\nContact: ${request.contact}`,
            contact: request.contact,
            budget_claws: 0
          })
        });
      } catch (_) {}

      return res.json({ ok: true });
    }

    // Close a request
    if (action === 'close') {
      if (!id) return res.status(400).json({ error: 'id required' });
      await supabase.from('council_requests').update({ status: 'closed', updated_at: new Date().toISOString() }).eq('id', id);
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
