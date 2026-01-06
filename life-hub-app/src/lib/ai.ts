import { Message, LifeMemory } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Constants from 'expo-constants';

// Initialize Gemini
const geminiApiKey = Constants.expoConfig?.extra?.geminiApiKey ||
    process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

// Check if Gemini is configured
const isGeminiConfigured = () => {
    return geminiApiKey && geminiApiKey !== 'your_gemini_api_key_here';
};

// Mock memories for development/demo
const MOCK_MEMORIES: LifeMemory[] = [
    {
        id: '1',
        user_id: 'demo',
        source_app: 'trueform',
        event_type: 'workout_complete',
        content: 'Completed 30 min shoulder rehab. Pain level reduced from 5/10 to 3/10.',
        metadata: { bodyPart: 'shoulder', duration: 30, painLevel: 3 },
        created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
        id: '2',
        user_id: 'demo',
        source_app: 'foodvital',
        event_type: 'food_logged',
        content: 'Logged breakfast: Oatmeal with berries and protein shake. 450 calories, 35g protein.',
        metadata: { meal: 'breakfast', calories: 450, protein: 35 },
        created_at: new Date(Date.now() - 43200000).toISOString(),
    },
    {
        id: '3',
        user_id: 'demo',
        source_app: 'cheshbon',
        event_type: 'reflection_saved',
        content: 'Reflected on Philippians 4:13 - Finding strength through faith during challenging times.',
        metadata: { verse: 'Philippians 4:13', theme: 'strength' },
        created_at: new Date(Date.now() - 21600000).toISOString(),
    },
    {
        id: '4',
        user_id: 'demo',
        source_app: 'opticrep',
        event_type: 'workout_complete',
        content: 'Morning workout: 3 sets of push-ups (15 reps), 3 sets of squats (20 reps). Form score: 85%.',
        metadata: { exercises: ['push-ups', 'squats'], formScore: 85 },
        created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
        id: '5',
        user_id: 'demo',
        source_app: 'deals',
        event_type: 'alert_triggered',
        content: 'Found deal: Trek mountain bike for $350 in Cambridge (usually $600+).',
        metadata: { item: 'mountain bike', price: 350, savings: 250 },
        created_at: new Date().toISOString(),
    },
];

// Track data source for transparency
let usingDemoData = true;

// Fetch recent memories (real or mock)
export async function fetchRecentMemories(limit: number = 10): Promise<LifeMemory[]> {
    if (!isSupabaseConfigured()) {
        console.log('Supabase not configured - using demo data');
        usingDemoData = true;
        return MOCK_MEMORIES.slice(0, limit);
    }

    try {
        const { data, error } = await supabase
            .from('life_memories')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching memories:', error);
            usingDemoData = true;
            return MOCK_MEMORIES.slice(0, limit);
        }

        // If no real data, fall back to mock
        if (!data || data.length === 0) {
            console.log('No real memories found - using demo data');
            usingDemoData = true;
            return MOCK_MEMORIES.slice(0, limit);
        }

        console.log(`Found ${data.length} real memories!`);
        usingDemoData = false;
        return data;
    } catch (e) {
        console.error('Supabase error:', e);
        usingDemoData = true;
        return MOCK_MEMORIES.slice(0, limit);
    }
}

// Check if using demo data
export function isUsingDemoData(): boolean {
    return usingDemoData;
}

// Build context string from memories
function buildContextFromMemories(memories: LifeMemory[]): string {
    if (memories.length === 0) {
        return 'No recent memories available.';
    }

    const contextLines = memories.map((m, i) => {
        const date = new Date(m.created_at).toLocaleDateString();
        return `${i + 1}. [${m.source_app}] ${date}: ${m.content}`;
    });

    return contextLines.join('\n');
}

// System prompt for Life Hub AI
const SYSTEM_PROMPT = `You are Life Hub, a personal AI assistant that knows about the user's life through their connected apps. You have access to their:
- Workout and physiotherapy data (TrueForm AI, OpticRep)
- Nutrition logs (FoodVital)
- Bible reflections (Cheshbon)
- Dream journal (REMcast)
- Local deals (Deals app)
- Content creation (Cadence AI)
- Crypto/DeFi portfolio (DeFi Hub)

Be helpful, personalized, and encouraging. Reference specific data from their life when relevant.
Use emojis sparingly to be friendly. Keep responses concise but insightful.
If asked about something you don't have data for, acknowledge it and suggest what apps could track it.`;

// Generate AI response using Gemini
export async function generateAIResponse(
    userMessage: string,
    conversationHistory: Message[]
): Promise<string> {
    // Fetch relevant memories for context
    const memories = await fetchRecentMemories(10);
    const context = buildContextFromMemories(memories);

    // If Gemini is not configured, use smart mock responses
    if (!isGeminiConfigured() || !genAI) {
        return generateMockResponse(userMessage, context);
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        // Build the prompt with context
        const prompt = `${SYSTEM_PROMPT}

Here is the user's recent activity from their connected apps:
${context}

Previous conversation:
${conversationHistory.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n')}

User: ${userMessage}

Please respond helpfully based on their life data:`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Gemini API error:', error);
        // Fall back to mock response if API fails
        return generateMockResponse(userMessage, context);
    }
}

// Smart mock responses based on keywords
function generateMockResponse(userMessage: string, context: string): string {
    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes('week') || lowerMessage.includes('summary')) {
        return `📊 **Your Week at a Glance**

Based on your recent activity across your apps:

🏋️ **Fitness**: You completed 2 workouts including shoulder rehab (TrueForm) and a morning routine (OpticRep). Your form score averaged 85%!

🥗 **Nutrition**: You logged a healthy breakfast with good protein intake (35g). Keep up the balanced meals!

🙏 **Spiritual**: You reflected on Philippians 4:13, finding strength during challenging times.

💰 **Deals**: I spotted a great deal on a Trek mountain bike in Cambridge - $250 below market price!

Your shoulder pain has improved from 5/10 to 3/10. Great progress! 🎉`;
    }

    if (lowerMessage.includes('workout') || lowerMessage.includes('exercise') || lowerMessage.includes('fitness')) {
        return `💪 **Your Recent Workouts**

From TrueForm and OpticRep:

1. **Shoulder Rehab** (yesterday) - 30 minutes
   - Pain level: 3/10 (improved from 5/10!)
   
2. **Morning Routine** (today)
   - Push-ups: 3 sets × 15 reps
   - Squats: 3 sets × 20 reps
   - Form Score: 85% ⭐

Your consistency is paying off. Your shoulder is healing well!`;
    }

    if (lowerMessage.includes('food') || lowerMessage.includes('eat') || lowerMessage.includes('nutrition') || lowerMessage.includes('diet')) {
        return `🥗 **Your Nutrition Today**

From FoodVital:

**Breakfast**: Oatmeal with berries + protein shake
- Calories: 450
- Protein: 35g
- Great start to the day!

Keep logging your meals to track your progress toward your nutrition goals.`;
    }

    if (lowerMessage.includes('deal') || lowerMessage.includes('save') || lowerMessage.includes('buy')) {
        return `🔥 **Hot Deal Alert**

Found in Cambridge via your Deals app:

**Trek Mountain Bike**
- Price: $350 (usually $600+)
- Savings: $250 (42% off!)
- Location: Cambridge, ON

This matches your saved search criteria. Want me to help you evaluate this deal?`;
    }

    if (lowerMessage.includes('bible') || lowerMessage.includes('faith') || lowerMessage.includes('pray') || lowerMessage.includes('spirit')) {
        return `🙏 **Your Spiritual Journey**

From Cheshbon (Bible Social):

Your recent reflection on **Philippians 4:13**:
> "I can do all things through Christ who strengthens me."

Theme: Finding strength during challenging times

Reading streak: 7 days 🔥

Would you like me to suggest related verses or share your past reflections on similar themes?`;
    }

    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
        return `👋 Hey there! I'm your Life Hub AI assistant.

I'm connected to all your apps and can help you with insights about:
- 🏋️ Workouts & rehab progress
- 🥗 Nutrition & meal tracking
- 🙏 Bible reflections & spiritual journey
- 💰 Hot deals in your area
- 💭 Dream patterns & interpretations

What would you like to know about your life today?`;
    }

    // Default response with context awareness
    return `I'm analyzing your data from across your apps...

Based on your recent memories:

${context}

Is there something specific you'd like to know about your workouts, nutrition, spiritual journey, or those deals I'm tracking for you?

*Note: Add your Gemini API key for smarter, more personalized responses!*`;
}
