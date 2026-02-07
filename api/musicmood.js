// MusicMood — Describe your mood, AI creates a personalized playlist
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const { mode, mood, activity, genres, energy, question, history, context } = req.body;

    if (!mode) return res.status(400).json({ error: 'Mode is required' });

    try {
        let systemInstruction, contents;

        if (mode === 'generate') {
            if (!mood) return res.status(400).json({ error: 'Mood description is required' });

            systemInstruction = `You are an expert music curator and playlist designer with deep knowledge of music across all genres, eras, and cultures. Create personalized playlists based on mood, activity, and preferences.

Return ONLY valid JSON (no markdown fences) with this structure:
{
  "playlistName": "Creative, evocative playlist name",
  "playlistDescription": "2-3 sentence description of the vibe",
  "moodAnalysis": {
    "primaryMood": "The dominant mood detected",
    "energy": "low|medium|high",
    "valence": "negative|neutral|positive",
    "tempo": "slow|moderate|upbeat|fast",
    "keywords": ["mood", "keywords"]
  },
  "tracks": [
    {
      "title": "Song title",
      "artist": "Artist name",
      "album": "Album name",
      "year": 2020,
      "genre": "Genre",
      "duration": "3:45",
      "whyItFits": "Why this song matches the mood",
      "spotifySearchQuery": "search query to find on Spotify"
    }
  ],
  "flowDescription": "How the playlist flows from start to finish — the emotional arc",
  "genreBreakdown": [
    { "genre": "Genre name", "percentage": 40, "reasoning": "Why this genre fits" }
  ],
  "moodProgression": [
    { "phase": "Opening", "tracks": "1-3", "vibe": "How these tracks set the tone" },
    { "phase": "Peak", "tracks": "4-7", "vibe": "The emotional peak" },
    { "phase": "Wind Down", "tracks": "8-10", "vibe": "How it closes" }
  ],
  "similarPlaylists": [
    { "name": "Playlist concept", "description": "What it would sound like" }
  ],
  "listeningSuggestions": {
    "bestTime": "When to listen",
    "setting": "Ideal setting",
    "activity": "Best paired activity"
  }
}

Rules:
- Mood: ${mood}
- Activity: ${activity || 'general listening'}
- Preferred genres: ${genres || 'all genres welcome'}
- Energy level: ${energy || 'match the mood'}
- Generate 10-12 tracks
- Mix well-known and discovery tracks (70/30 ratio)
- Ensure smooth transitions between songs
- Include songs from different decades when appropriate
- Use REAL songs by REAL artists (do not make up songs)
- Consider BPM and key for smooth flow
- Return ONLY valid JSON`;

            contents = [{ parts: [{ text: `Create a playlist for this mood: ${mood}. ${activity ? 'Activity: ' + activity + '.' : ''} ${genres ? 'Preferred genres: ' + genres + '.' : ''} ${energy ? 'Energy: ' + energy + '.' : ''}` }] }];

        } else if (mode === 'qa') {
            if (!question) return res.status(400).json({ error: 'Question is required' });

            systemInstruction = `You are an expert music curator. The user generated a playlist and has follow-up questions about music recommendations, genres, artists, or playlist adjustments. Be knowledgeable and enthusiastic. Use markdown.`;

            const messages = [];
            if (context) messages.push({ parts: [{ text: `Playlist context: ${context.slice(0, 50000)}` }] });
            if (history?.length > 0) {
                for (const msg of history) messages.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] });
            }
            messages.push({ parts: [{ text: question }] });
            contents = messages;

        } else {
            return res.status(400).json({ error: 'Invalid mode' });
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents, systemInstruction: { parts: [{ text: systemInstruction }] }, generationConfig: { temperature: 0.8, maxOutputTokens: 8192 } })
            }
        );

        const data = await response.json();
        if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Gemini API error' });
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (mode === 'qa') return res.status(200).json({ answer: responseText });
        try {
            const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            return res.status(200).json(JSON.parse(cleaned));
        } catch (e) { return res.status(200).json({ raw: responseText }); }
    } catch (error) {
        console.error('MusicMood API error:', error);
        return res.status(500).json({ error: 'Failed to generate playlist' });
    }
}
