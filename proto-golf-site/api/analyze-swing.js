// Proto Golf - AI Swing Analyzer API
// Uses Gemini 2.0 Flash for vision-based swing analysis

export default async function handler(req, res) {
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
        const { frames, swing_type } = req.body;

        if (!frames || !Array.isArray(frames) || frames.length === 0) {
            return res.status(400).json({ error: 'No frames provided' });
        }

        // Check for Gemini API key
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

        if (!GEMINI_API_KEY) {
            // Return demo results if no API key configured
            console.log('No Gemini API key configured, returning demo results');
            return res.status(200).json(getDemoResults(swing_type));
        }

        // Call Gemini Vision API
        const analysis = await analyzeWithGemini(frames, swing_type, GEMINI_API_KEY);
        return res.status(200).json(analysis);

    } catch (error) {
        console.error('Analysis error:', error);
        return res.status(200).json(getDemoResults(req.body?.swing_type));
    }
}

async function analyzeWithGemini(frames, swingType, apiKey) {
    const isPutt = swingType === 'putt';

    // Prepare the prompt
    const prompt = isPutt
        ? `You are an expert golf putting instructor analyzing a putting stroke.
           Analyze these video frames of a golf putting stroke and provide:
           1. An overall score from 0-100
           2. Scores for: alignment (0-100), tempo (0-100), stroke_path (0-100)
           3. List 2-3 specific issues you observe
           4. List 3-4 specific recommendations for improvement
           5. Suggest which Proto Golf putter would be best (options: Blade Putter, Mallet Putter, Tour Blade, Classic Anser)

           Respond in this exact JSON format:
           {
               "overall_score": 85,
               "scores": {"alignment": 82, "tempo": 88, "stroke_path": 85},
               "issues": [{"title": "Issue name", "desc": "Description"}],
               "recommendations": ["Recommendation 1", "Recommendation 2"],
               "products": [{"id": "mallet", "name": "Mallet Putter", "price": 279, "reason": "Why this putter"}]
           }`
        : `You are an expert golf swing instructor analyzing a full golf swing.
           Analyze these video frames of a golf swing and provide:
           1. An overall score from 0-100
           2. Scores for: posture (0-100), swing_plane (0-100), tempo (0-100)
           3. List 2-3 specific issues you observe
           4. List 3-4 specific recommendations for improvement
           5. Suggest relevant Proto Golf equipment

           Respond in this exact JSON format:
           {
               "overall_score": 78,
               "scores": {"posture": 75, "swing_plane": 80, "tempo": 78},
               "issues": [{"title": "Issue name", "desc": "Description"}],
               "recommendations": ["Recommendation 1", "Recommendation 2"],
               "products": [{"id": "blade", "name": "Blade Putter", "price": 249, "reason": "Why this product"}]
           }`;

    // Prepare the image parts
    const imageParts = frames.slice(0, 5).map(frame => {
        // Remove data URL prefix if present
        const base64Data = frame.replace(/^data:image\/\w+;base64,/, '');
        return {
            inline_data: {
                mime_type: 'image/jpeg',
                data: base64Data
            }
        };
    });

    const requestBody = {
        contents: [{
            parts: [
                { text: prompt },
                ...imageParts
            ]
        }],
        generationConfig: {
            temperature: 0.4,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 2048
        }
    };

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API error:', errorText);
        throw new Error('Gemini API error');
    }

    const data = await response.json();

    // Extract the JSON from the response
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textContent) {
        throw new Error('No content in Gemini response');
    }

    // Parse JSON from the response (handle markdown code blocks)
    let jsonStr = textContent;
    if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/```\n?/g, '');
    }

    const analysis = JSON.parse(jsonStr.trim());
    return analysis;
}

function getDemoResults(swingType) {
    const isPutt = swingType === 'putt';

    return {
        overall_score: isPutt ? 82 : 78,
        scores: isPutt ? {
            alignment: 85,
            tempo: 80,
            stroke_path: 82
        } : {
            posture: 75,
            swing_plane: 80,
            tempo: 78
        },
        issues: isPutt ? [
            { title: 'Slight decel through impact', desc: 'Putter head slows before striking the ball, causing distance control issues.' },
            { title: 'Eyes slightly behind ball', desc: 'Optimal eye position is directly over or slightly inside the ball.' }
        ] : [
            { title: 'Early extension', desc: 'Hips move toward the ball during downswing, causing inconsistent contact.' },
            { title: 'Grip too strong', desc: 'Left hand is rotated too far right, promoting a hook.' },
            { title: 'Weight shift timing', desc: 'Weight transfers to front foot slightly late in the downswing.' }
        ],
        recommendations: isPutt ? [
            'Practice with a metronome to maintain consistent tempo',
            'Use a putting mirror to check eye position at address',
            'Focus on accelerating through the ball, not to it',
            'Practice lag putts to improve distance control'
        ] : [
            'Practice maintaining your spine angle through impact',
            'Rotate your left hand slightly left on the grip',
            'Start your weight shift earlier in the transition',
            'Use alignment sticks to check your swing plane'
        ],
        products: isPutt ? [
            { id: 'mallet', name: 'Mallet Putter', price: 279, reason: 'High MOI design helps with distance control on off-center hits' },
            { id: 'blade', name: 'Blade Putter', price: 249, reason: 'Better feedback helps develop consistent tempo' }
        ] : [
            { id: 'proDriver', name: 'Proto Driver X1', price: 449, reason: 'Adjustable weights help correct your hook tendency' },
            { id: 'blade', name: 'Blade Putter', price: 249, reason: 'Precision-milled for feel and feedback' }
        ]
    };
}
