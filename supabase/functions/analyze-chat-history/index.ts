import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { messages, source, messageCount, conversationCount, storeInsights } = await req.json();

    if (!messages) {
      throw new Error("No messages provided");
    }

    // Analyze with Gemini
    const analysis = await analyzeWithGemini(messages, source, messageCount, conversationCount);

    // Store insights if user consented
    if (storeInsights && analysis) {
      await storeAnalysisInsights(analysis, source, messageCount, conversationCount);
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function analyzeWithGemini(
  messages: string,
  source: string,
  messageCount: number,
  conversationCount: number
) {
  const prompt = `You are analyzing a user's AI chat history to understand their needs and recommend apps.

Here are ${messageCount} user messages from ${conversationCount} conversations exported from ${source}:

---
${messages}
---

Analyze these messages and return a JSON object with this exact structure:
{
  "topics": [
    { "topic": "Category Name", "count": estimated_mentions }
  ],
  "insights": [
    {
      "category": "Insight Category",
      "description": "A brief insight about the user's needs in this area",
      "icon": "appropriate emoji"
    }
  ],
  "recommendations": [
    {
      "id": "app_id",
      "name": "App Name",
      "description": "Why this app fits their needs",
      "icon": "emoji",
      "iconBg": "linear-gradient(135deg, #color1, #color2)",
      "matchScore": 85
    }
  ],
  "summary": "A 1-2 sentence summary of what this user primarily uses AI for",
  "customAppIdea": "If no existing app fits well, suggest a custom app that could be built for them"
}

Available SUITE apps to recommend (use these IDs):
- foodvitals: Nutrition tracking with AI insights (health, diet, weight loss)
- trueform: AI physiotherapy and exercise guidance (back pain, posture, mobility)
- opticrep: AI workout trainer with form analysis (fitness, strength training)
- cheshbon: Financial reflection and tracking (money, budgeting, spending)
- remcast: Smart reminders and habit tracking (productivity, routines)
- defi-knowledge: Learn DeFi and crypto concepts (crypto, trading, blockchain)

Focus on:
1. What problems they're trying to solve
2. Recurring themes in their questions
3. Tools or apps they've asked about
4. Pain points they mention

Return ONLY valid JSON, no markdown or explanation.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("No response from Gemini");
  }

  // Parse JSON from response (handle potential markdown wrapping)
  let jsonText = text.trim();
  if (jsonText.startsWith("```json")) {
    jsonText = jsonText.slice(7);
  }
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.slice(3);
  }
  if (jsonText.endsWith("```")) {
    jsonText = jsonText.slice(0, -3);
  }

  return JSON.parse(jsonText.trim());
}

async function storeAnalysisInsights(
  analysis: any,
  source: string,
  messageCount: number,
  conversationCount: number
) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.log("Supabase credentials not configured, skipping storage");
    return;
  }

  try {
    // Store anonymized aggregate data
    const insights = {
      source,
      message_count: messageCount,
      conversation_count: conversationCount,
      topics: analysis.topics?.map((t: any) => t.topic) || [],
      top_category: analysis.topics?.[0]?.topic || null,
      has_custom_app_need: !!analysis.customAppIdea,
      custom_app_idea: analysis.customAppIdea || null,
      created_at: new Date().toISOString(),
    };

    const response = await fetch(`${SUPABASE_URL}/rest/v1/chat_import_insights`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(insights),
    });

    if (!response.ok) {
      console.error("Failed to store insights:", await response.text());
    }
  } catch (error) {
    console.error("Error storing insights:", error);
  }
}
