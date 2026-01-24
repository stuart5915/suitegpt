-- SuiteGPT Use Cases Table
-- Stores user queries and AI responses for browsing and discovery

CREATE TABLE IF NOT EXISTS use_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query TEXT NOT NULL,
    response TEXT NOT NULL,
    recommended_app TEXT,
    category TEXT NOT NULL DEFAULT 'general',
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    is_curated BOOLEAN DEFAULT FALSE,
    is_visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast category queries
CREATE INDEX idx_use_cases_category ON use_cases(category);
CREATE INDEX idx_use_cases_is_visible ON use_cases(is_visible);
CREATE INDEX idx_use_cases_helpful ON use_cases(helpful_count DESC);

-- Enable RLS
ALTER TABLE use_cases ENABLE ROW LEVEL SECURITY;

-- Public can read visible use cases
CREATE POLICY "Public can view visible use cases"
    ON use_cases FOR SELECT
    USING (is_visible = TRUE);

-- Service role can do everything
CREATE POLICY "Service role has full access"
    ON use_cases FOR ALL
    USING (auth.role() = 'service_role');

-- Insert seed data with common use cases
INSERT INTO use_cases (query, response, recommended_app, category, is_curated, helpful_count) VALUES
-- Health & Nutrition
('I want to lose weight but hate tracking calories',
 'I totally get it - calorie counting can feel tedious and obsessive. FoodVitals takes a different approach: just snap photos of your meals throughout the week, and the AI analyzes your overall nutrition patterns. No counting, no logging numbers. It focuses on what matters - are you getting enough protein? Too much processed food? It gives you insights without the micromanagement.',
 'foodvitals', 'health', TRUE, 42),

('I need to track my nutrition better',
 'FoodVitals makes nutrition tracking simple - just photograph your meals and let the AI do the analysis. At the end of each week, you get insights about your eating patterns, macro balance, and suggestions for improvement. No calorie counting required.',
 'foodvitals', 'health', TRUE, 38),

('What should I eat to build muscle?',
 'Building muscle requires adequate protein and overall nutrition. FoodVitals can help you track whether you''re hitting your protein goals by analyzing your meal photos. It''ll tell you if you''re consistently under-eating protein or missing key nutrients for muscle recovery.',
 'foodvitals', 'health', TRUE, 31),

('I keep eating junk food and want to stop',
 'Breaking junk food habits starts with awareness. FoodVitals helps by showing you patterns - maybe you reach for snacks at 3pm, or order takeout every Thursday. Once you see the pattern, you can address it. The weekly AI insights highlight these trends without judgment.',
 'foodvitals', 'health', TRUE, 27),

-- Fitness & Pain
('I have back pain from sitting all day',
 'Desk work is brutal on your back. TrueForm AI has guided stretching routines specifically designed for desk workers - it''ll walk you through movements to release tension in your lower back, hip flexors, and shoulders. Even 5-10 minutes daily can make a huge difference.',
 'trueform', 'fitness', TRUE, 56),

('My posture is terrible and I want to fix it',
 'Poor posture usually comes from tight muscles and weak stabilizers. TrueForm AI can assess your movement patterns and give you targeted exercises. It focuses on strengthening your core and back while releasing tight chest and hip muscles that pull you forward.',
 'trueform', 'fitness', TRUE, 44),

('I hurt my shoulder and need rehab exercises',
 'Shoulder injuries need careful rehab. TrueForm AI provides physiotherapy-style exercise guidance - it''ll take you through mobility work, strengthening progressions, and help you understand what movements to avoid. Always good to check with a doctor first, but this can supplement your recovery.',
 'trueform', 'fitness', TRUE, 35),

('Good stretches for after working out',
 'Post-workout stretching is crucial for recovery. TrueForm AI has cool-down routines that target the muscles you just worked. It guides you through each stretch with proper form cues so you''re actually getting the benefit.',
 'trueform', 'fitness', TRUE, 29),

('I want to get stronger but don''t know where to start',
 'Starting a strength journey can feel overwhelming. OpticRep is your AI workout trainer - it creates personalized workout plans and watches your form in real-time to make sure you''re lifting safely. Great for beginners who want guidance without a personal trainer.',
 'opticrep', 'fitness', TRUE, 41),

('How do I know if my squat form is correct?',
 'Form is everything for squats. OpticRep uses AI to analyze your movement in real-time - it''ll tell you if your knees are caving, if you''re leaning too far forward, or if your depth is good. Like having a trainer watching every rep.',
 'opticrep', 'fitness', TRUE, 33),

-- Finance
('I want to get better with money',
 'Getting better with money starts with reflection, not just tracking. Cheshbon is a financial reflection app - it helps you understand your relationship with money, notice spending patterns, and build mindfulness around financial decisions. It''s less about budgets and more about awareness.',
 'cheshbon', 'finance', TRUE, 37),

('I spend money without thinking and regret it later',
 'Impulse spending often comes from emotional triggers. Cheshbon helps you pause and reflect on your spending patterns - what were you feeling when you made that purchase? Over time, you''ll notice your triggers and make more intentional choices.',
 'cheshbon', 'finance', TRUE, 29),

('How can I save more money?',
 'Saving more starts with understanding where your money actually goes. Cheshbon helps you reflect on your spending patterns and identify areas where you might be leaking money without realizing it. The insights often reveal easy wins.',
 'cheshbon', 'finance', TRUE, 25),

-- Productivity
('Help me build a morning routine',
 'A solid morning routine sets the tone for your day. RemCast can help you build and stick to one - it sends smart reminders at the right times, tracks your consistency, and adjusts based on your patterns. Start small: wake time, hydration, movement, then build from there.',
 'remcast', 'productivity', TRUE, 48),

('I keep forgetting important tasks',
 'RemCast is designed exactly for this - it''s a smart reminder system that learns your patterns. Set reminders that actually work for your schedule, get notifications at the right times, and track recurring tasks so nothing falls through the cracks.',
 'remcast', 'productivity', TRUE, 39),

('I want to build better daily habits',
 'Habits are built through consistency and good triggers. RemCast helps you set up daily reminders for the habits you want to build, tracks your streaks, and sends you nudges at times when you''re most likely to follow through.',
 'remcast', 'productivity', TRUE, 34),

('I need a better evening routine',
 'Evening routines are underrated for good sleep and next-day productivity. RemCast can guide you through a wind-down sequence - reminders to stop screens, prep for tomorrow, relaxation time. Customize it to what works for you.',
 'remcast', 'productivity', TRUE, 26),

-- Learning
('I want to learn about DeFi and crypto',
 'DeFi can seem complex, but it doesn''t have to be. DeFi Knowledge breaks down concepts like yield farming, liquidity pools, and staking into digestible lessons. It''s designed to take you from confused to confident, whether you''re a complete beginner or want to go deeper.',
 'defi-knowledge', 'learning', TRUE, 45),

('What is yield farming and how does it work?',
 'Yield farming is earning returns by providing your crypto to DeFi protocols. DeFi Knowledge has a whole module on this - it explains the mechanics, the risks, and how to evaluate opportunities. Much better than learning by losing money.',
 'defi-knowledge', 'learning', TRUE, 36),

('Is DeFi safe? What are the risks?',
 'DeFi has real risks - smart contract bugs, impermanent loss, rug pulls. DeFi Knowledge covers all of these honestly. Understanding the risks is the first step to navigating them safely. The platform teaches you how to evaluate protocols and protect yourself.',
 'defi-knowledge', 'learning', TRUE, 32),

('How do I start investing in crypto?',
 'Before investing, you need to understand what you''re getting into. DeFi Knowledge gives you the foundation - how blockchain works, different types of tokens, how to evaluate projects. Much better to learn first than to FOMO into something you don''t understand.',
 'defi-knowledge', 'learning', TRUE, 28);
