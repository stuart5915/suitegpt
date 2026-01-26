import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AppData {
  app_slug: string;
  data: Record<string, unknown>;
  last_synced_at: string;
}

interface InsightRequest {
  query: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const { query } = await req.json() as InsightRequest;

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has AI insights enabled
    const { data: settings, error: settingsError } = await supabase
      .from('user_ai_settings')
      .select('ai_insights_enabled, apps_included')
      .eq('user_id', user.id)
      .single();

    if (settingsError || !settings?.ai_insights_enabled) {
      return new Response(
        JSON.stringify({
          error: 'AI insights not enabled',
          message: 'Please enable AI insights in your settings to use this feature.'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's app data (only for apps they've opted into)
    const { data: appData, error: dataError } = await supabase
      .rpc('get_user_insights_data', { p_user_id: user.id });

    if (dataError) {
      console.error('Error fetching app data:', dataError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch app data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build context from app data
    const context = buildContextFromAppData(appData || []);

    // Generate insight using Claude API
    const insight = await generateInsight(query, context);

    return new Response(
      JSON.stringify({
        success: true,
        insight,
        apps_analyzed: appData?.map((d: AppData) => d.app_slug) || []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('AI Insights Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Build a summary context from user's app data
 */
function buildContextFromAppData(appData: AppData[]): string {
  if (appData.length === 0) {
    return 'No app data available.';
  }

  const summaries: string[] = [];

  for (const app of appData) {
    const summary = summarizeAppData(app.app_slug, app.data);
    if (summary) {
      summaries.push(summary);
    }
  }

  return summaries.join('\n\n');
}

/**
 * Create a human-readable summary of app data
 */
function summarizeAppData(appSlug: string, data: Record<string, unknown>): string {
  switch (appSlug) {
    case 'hydrotrack':
      return summarizeHydroTrack(data);
    case 'moodlog':
      return summarizeMoodLog(data);
    case 'sleepwell':
      return summarizeSleepWell(data);
    default:
      return `${appSlug}: ${JSON.stringify(data).slice(0, 200)}...`;
  }
}

function summarizeHydroTrack(data: Record<string, unknown>): string {
  const logs = data.logs as Array<{ date: string; amount: number }> || [];
  const goal = data.dailyGoal as number || 2000;

  if (logs.length === 0) return 'HydroTrack: No water intake logged yet.';

  // Get last 7 days
  const recentLogs = logs.slice(-7);
  const avgIntake = recentLogs.reduce((sum, log) => sum + log.amount, 0) / recentLogs.length;
  const goalMet = recentLogs.filter(log => log.amount >= goal).length;

  return `HydroTrack (Water Intake):
- Daily goal: ${goal}ml
- Average intake (last ${recentLogs.length} days): ${Math.round(avgIntake)}ml
- Days goal was met: ${goalMet}/${recentLogs.length}
- Latest entry: ${recentLogs[recentLogs.length - 1]?.amount || 0}ml`;
}

function summarizeMoodLog(data: Record<string, unknown>): string {
  const entries = data.entries as Array<{ date: string; mood: number; notes?: string }> || [];

  if (entries.length === 0) return 'MoodLog: No mood entries yet.';

  const recentEntries = entries.slice(-7);
  const avgMood = recentEntries.reduce((sum, e) => sum + e.mood, 0) / recentEntries.length;
  const moodLabels = ['Very Low', 'Low', 'Neutral', 'Good', 'Great'];

  return `MoodLog (Mood Tracking):
- Average mood (last ${recentEntries.length} days): ${avgMood.toFixed(1)}/5 (${moodLabels[Math.round(avgMood) - 1] || 'N/A'})
- Total entries: ${entries.length}
- Recent moods: ${recentEntries.map(e => e.mood).join(', ')}`;
}

function summarizeSleepWell(data: Record<string, unknown>): string {
  const logs = data.logs as Array<{ date: string; hours: number; quality: number }> || [];

  if (logs.length === 0) return 'SleepWell: No sleep data logged yet.';

  const recentLogs = logs.slice(-7);
  const avgHours = recentLogs.reduce((sum, log) => sum + log.hours, 0) / recentLogs.length;
  const avgQuality = recentLogs.reduce((sum, log) => sum + log.quality, 0) / recentLogs.length;

  return `SleepWell (Sleep Tracking):
- Average sleep (last ${recentLogs.length} nights): ${avgHours.toFixed(1)} hours
- Average quality: ${avgQuality.toFixed(1)}/5
- Total nights logged: ${logs.length}`;
}

/**
 * Generate personalized insight using Claude API
 */
async function generateInsight(query: string, context: string): Promise<string> {
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

  if (!anthropicKey) {
    return "I can see your app data, but the AI service isn't configured yet. Here's what I found:\n\n" + context;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: `You are a helpful personal AI assistant analyzing a user's health and wellness data from their SUITE apps.
Provide personalized, actionable insights based on their data. Be encouraging but honest.
Keep responses concise and focused on the user's question.

User's app data summary:
${context}`,
        messages: [
          { role: 'user', content: query }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Claude API error:', error);
      return "I'm having trouble analyzing your data right now. Please try again later.";
    }

    const result = await response.json();
    return result.content?.[0]?.text || "I couldn't generate an insight. Please try again.";

  } catch (error) {
    console.error('Error calling Claude API:', error);
    return "I'm having trouble analyzing your data right now. Please try again later.";
  }
}
