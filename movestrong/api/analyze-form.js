// MoveStrong - AI Form Analyzer API
// Uses Google Gemini Vision to analyze exercise form from video

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Exercise-specific analysis prompts
const EXERCISE_PROMPTS = {
    squat: `Analyze this squat video for form issues. Focus on:
- Knee tracking (should stay over toes, not caving)
- Hip hinge and depth (at least parallel)
- Back position (neutral spine, not rounding)
- Bar position and balance
- Foot placement and pressure distribution`,

    deadlift: `Analyze this deadlift video for form issues. Focus on:
- Back position (neutral spine throughout)
- Bar path (close to body)
- Hip hinge mechanics
- Lockout position
- Starting position setup`,

    bench: `Analyze this bench press video for form issues. Focus on:
- Bar path (slight arc toward face)
- Scapular retraction and stability
- Elbow angle and flare
- Foot position and leg drive
- Wrist alignment`,

    ohp: `Analyze this overhead press video for form issues. Focus on:
- Bar path (straight up, around face)
- Core bracing and rib position
- Shoulder mobility and positioning
- Head position
- Lockout mechanics`,

    row: `Analyze this rowing movement for form issues. Focus on:
- Back position and angle
- Pulling path and elbow position
- Scapular movement
- Core stability
- Range of motion`,

    pullup: `Analyze this pull-up/chin-up video for form issues. Focus on:
- Full range of motion
- Shoulder engagement at bottom
- Core engagement (no excessive swinging)
- Elbow position
- Neck position`,

    lunge: `Analyze this lunge video for form issues. Focus on:
- Knee tracking over toes
- Step length and depth
- Torso position (upright)
- Balance and stability
- Hip mobility`,

    other: `Analyze this exercise video for general form issues. Focus on:
- Overall body positioning
- Range of motion
- Control and tempo
- Balance and stability
- Any compensatory movements`
};

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { exercise, videoData } = req.body;

        // Check for API key
        if (!process.env.GEMINI_API_KEY) {
            console.log('Gemini API not configured, returning demo analysis');
            return res.json(getDemoAnalysis(exercise));
        }

        // Get exercise-specific prompt
        const exercisePrompt = EXERCISE_PROMPTS[exercise] || EXERCISE_PROMPTS.other;

        // Full analysis prompt
        const prompt = `You are an expert personal trainer and movement specialist analyzing exercise form.

${exercisePrompt}

Provide your analysis in the following JSON format:
{
    "score": <number 0-100>,
    "issues": [<list of specific form issues observed>],
    "corrections": [<list of specific corrections for each issue>],
    "recommendation": "<overall recommendation for improvement>"
}

Be specific and actionable. Focus on safety first, then efficiency. Score based on:
- 90-100: Excellent form, minor tweaks only
- 75-89: Good form with some issues to address
- 60-74: Needs work on several aspects
- Below 60: Significant form issues, recommend deload and focus on technique

Return ONLY valid JSON, no other text.`;

        // Initialize model
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

        // Prepare content parts
        const parts = [
            { text: prompt }
        ];

        // Add video data if provided
        if (videoData) {
            parts.push({
                inlineData: {
                    mimeType: 'video/mp4',
                    data: videoData
                }
            });
        }

        // Generate analysis
        const result = await model.generateContent(parts);
        const response = await result.response;
        const text = response.text();

        // Parse JSON response
        let analysis;
        try {
            // Extract JSON from response (handle markdown code blocks)
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                analysis = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            console.error('Failed to parse Gemini response:', text);
            return res.json(getDemoAnalysis(exercise));
        }

        return res.json(analysis);

    } catch (error) {
        console.error('Analysis error:', error);
        return res.status(500).json({
            error: 'Analysis failed',
            message: error.message
        });
    }
};

// Demo analysis fallback
function getDemoAnalysis(exercise) {
    const analyses = {
        squat: {
            score: 72,
            issues: [
                'Knees caving inward at the bottom of the movement',
                'Forward lean is excessive - torso angle too horizontal',
                'Depth is slightly above parallel'
            ],
            corrections: [
                'Focus on pushing knees out over toes throughout the lift - think "spread the floor"',
                'Engage core more and think "chest up" during descent',
                'Work on ankle mobility to achieve better depth',
                'Consider elevating heels slightly with plates or squat shoes'
            ],
            recommendation: 'Focus on mobility work (ankle and hip flexors) before your next squat session. Practice goblet squats to groove proper mechanics before loading heavy.'
        },
        deadlift: {
            score: 68,
            issues: [
                'Lower back rounding at the start of the pull',
                'Bar drifting away from the body mid-lift',
                'Lockout is incomplete - hips not fully extended'
            ],
            corrections: [
                'Set your back before pulling - think "proud chest" and engage lats',
                'Keep the bar dragging up your legs throughout the movement',
                'Squeeze glutes hard at the top to complete lockout',
                'Consider Romanian deadlifts to strengthen hip hinge pattern'
            ],
            recommendation: 'Work on hip hinge mechanics with lighter weight. Add Romanian deadlifts and good mornings to your accessory work to build posterior chain strength and motor patterns.'
        },
        bench: {
            score: 78,
            issues: [
                'Bar path pressing straight up instead of back toward face',
                'Shoulder blades losing retraction mid-set'
            ],
            corrections: [
                'Press the bar in a slight arc toward your face at lockout',
                'Keep shoulder blades pinched and "in your back pockets" throughout',
                'Maintain arch and leg drive throughout the entire set'
            ],
            recommendation: 'Practice pause reps at the bottom to improve stability and bar control. Focus on maintaining upper back tightness from unrack to rerack.'
        },
        ohp: {
            score: 74,
            issues: [
                'Excessive lower back arch during the press',
                'Bar path going around the head instead of straight up',
                'Incomplete lockout at the top'
            ],
            corrections: [
                'Squeeze glutes and brace core hard to prevent excessive arch',
                'Move your head back slightly to allow straight bar path, then push head through at lockout',
                'Fully extend arms and push head through at the top position'
            ],
            recommendation: 'Work on thoracic mobility and practice strict pressing with lighter weight. Consider adding Z-press to your routine to reinforce core stability.'
        },
        row: {
            score: 76,
            issues: [
                'Using too much body momentum to move the weight',
                'Not fully extending at the bottom of the movement'
            ],
            corrections: [
                'Reduce weight and focus on controlled, strict reps',
                'Get a full stretch at the bottom before initiating the pull',
                'Lead with your elbows and squeeze shoulder blades together at the top'
            ],
            recommendation: 'Focus on the mind-muscle connection with your back. Try paused reps at the top to ensure full scapular retraction.'
        },
        pullup: {
            score: 70,
            issues: [
                'Not reaching full extension at the bottom',
                'Excessive kipping/swinging motion',
                'Chin not clearing the bar at top'
            ],
            corrections: [
                'Start each rep from a dead hang with arms fully extended',
                'Control the descent and minimize swinging',
                'Pull until chin is clearly above bar, pause briefly at top'
            ],
            recommendation: 'Consider using assisted pull-ups or band assistance to practice proper form through full range of motion. Quality over quantity.'
        },
        lunge: {
            score: 75,
            issues: [
                'Front knee extending past toes',
                'Torso leaning forward excessively',
                'Instability and wobbling during movement'
            ],
            corrections: [
                'Take a longer stride to keep shin more vertical',
                'Keep torso upright by engaging core and looking forward',
                'Slow down the movement and focus on balance before adding weight'
            ],
            recommendation: 'Practice static lunges before moving to walking lunges. Focus on stability and control. Consider split squats to build single-leg strength.'
        }
    };

    return analyses[exercise] || {
        score: 73,
        issues: [
            'Some form breakdown observed during the movement',
            'Range of motion could be improved',
            'Tempo and control need work'
        ],
        corrections: [
            'Focus on controlling the eccentric (lowering) phase',
            'Work on mobility to achieve full range of motion',
            'Consider reducing weight to perfect technique'
        ],
        recommendation: 'Book a form session with your trainer to get personalized feedback and corrections for this movement.'
    };
}
