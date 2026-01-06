// Gemini Vision API integration for screenshot analysis

import { GoogleGenerativeAI } from '@google/generative-ai';
import { GeminiAnalysisResult } from '../types';
import { CATEGORIES, CategoryType } from '../constants/categories';

// API key should be stored securely - for now using environment variable pattern
// In production, consider using expo-secure-store or a backend proxy
const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

const genAI = new GoogleGenerativeAI(API_KEY);

const ANALYSIS_PROMPT = `Analyze this screenshot of a deal, coupon, or marketplace listing. 
Extract the following information in JSON format:

{
  "title": "Brief title of the deal or item",
  "description": "Short description of what's being offered",
  "price": <number or null if not shown>,
  "originalPrice": <original price if discounted, or null>,
  "category": "<one of: restaurants, groceries, electronics, furniture, sports, vehicles, clothing, home-garden, services, other>",
  "location": "<specific location if mentioned, or null>",
  "expiresAt": "<expiry date in ISO format if mentioned, or null>"
}

Focus on deals and listings relevant to Cambridge, Ontario area.
If this doesn't appear to be a valid deal or listing, return: {"error": "Not a valid deal or listing"}

Respond ONLY with the JSON object, no additional text.`;

export async function analyzeScreenshot(imageBase64: string): Promise<GeminiAnalysisResult> {
    if (!API_KEY) {
        return {
            success: false,
            error: 'Gemini API key not configured. Please add EXPO_PUBLIC_GEMINI_API_KEY to your environment.',
            confidence: 0,
        };
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const result = await model.generateContent([
            ANALYSIS_PROMPT,
            {
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: imageBase64,
                },
            },
        ]);

        const response = await result.response;
        const text = response.text();

        // Parse the JSON response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return {
                success: false,
                error: 'Failed to parse Gemini response',
                confidence: 0,
            };
        }

        const parsed = JSON.parse(jsonMatch[0]);

        if (parsed.error) {
            return {
                success: false,
                error: parsed.error,
                confidence: 0.5,
            };
        }

        // Validate and normalize category
        const validCategory = Object.values(CATEGORIES).includes(parsed.category as CategoryType)
            ? parsed.category
            : CATEGORIES.OTHER;

        return {
            success: true,
            deal: {
                title: parsed.title || 'Untitled Deal',
                description: parsed.description || '',
                price: typeof parsed.price === 'number' ? parsed.price : undefined,
                originalPrice: typeof parsed.originalPrice === 'number' ? parsed.originalPrice : undefined,
                category: validCategory,
                location: parsed.location || undefined,
                expiresAt: parsed.expiresAt || undefined,
            },
            confidence: 0.85,
        };
    } catch (error) {
        console.error('Gemini analysis error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error during analysis',
            confidence: 0,
        };
    }
}

// Helper to convert image URI to base64
export async function imageToBase64(uri: string): Promise<string> {
    const response = await fetch(uri);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            // Remove the data URL prefix
            const base64Data = base64.split(',')[1];
            resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Types for AI suggestions
export interface SearchSuggestion {
    relatedTerms: string[];
    suggestedCategory: string | null;
    priceRange: { min: number; max: number } | null;
    brands: string[];
    tips: string;
}

const SUGGESTION_PROMPT = `You are helping a user search for deals on Kijiji and Facebook Marketplace in Cambridge, Ontario.
The user is typing a search query. Based on their input, provide helpful suggestions in JSON format:

{
  "relatedTerms": ["array of 3-5 related search terms they might also want"],
  "suggestedCategory": "one of: restaurants, groceries, electronics, furniture, sports, vehicles, clothing, home-garden, services, other (or null if unclear)",
  "priceRange": {"min": typical_low_price, "max": typical_high_price} or null if not applicable,
  "brands": ["array of 2-4 popular brands for this item type, or empty if not applicable"],
  "tips": "One short helpful tip for finding good deals on this item"
}

Be specific to used/second-hand marketplace items. Respond ONLY with JSON.`;

export async function getSearchSuggestions(query: string): Promise<SearchSuggestion | null> {
    if (!API_KEY || query.trim().length < 2) {
        return null;
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const result = await model.generateContent([
            SUGGESTION_PROMPT,
            `User is searching for: "${query}"`,
        ]);

        const response = await result.response;
        const text = response.text();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return null;
        }

        const parsed = JSON.parse(jsonMatch[0]);

        return {
            relatedTerms: parsed.relatedTerms || [],
            suggestedCategory: parsed.suggestedCategory || null,
            priceRange: parsed.priceRange || null,
            brands: parsed.brands || [],
            tips: parsed.tips || '',
        };
    } catch (error) {
        console.error('Suggestion error:', error);
        return null;
    }
}

// Search through saved deals with AI matching
export async function searchDealsWithAI(
    query: string,
    deals: { title: string; description: string; id: string }[]
): Promise<string[]> {
    if (!API_KEY || deals.length === 0) {
        // Fallback to simple text matching
        const q = query.toLowerCase();
        return deals
            .filter(d =>
                d.title.toLowerCase().includes(q) ||
                d.description.toLowerCase().includes(q)
            )
            .map(d => d.id);
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const dealsList = deals.map((d, i) => `${i}: "${d.title}" - ${d.description}`).join('\n');

        const result = await model.generateContent([
            `Given this search query: "${query}"
            
Which of these deals are relevant? Return ONLY a JSON array of the index numbers that match.
Consider semantic meaning, not just exact text matches.

Deals:
${dealsList}

Respond with JSON array like [0, 2, 5] or [] if none match.`,
        ]);

        const response = await result.response;
        const text = response.text();

        const jsonMatch = text.match(/\[[\d,\s]*\]/);
        if (!jsonMatch) return [];

        const indices: number[] = JSON.parse(jsonMatch[0]);
        return indices.filter(i => i < deals.length).map(i => deals[i].id);
    } catch (error) {
        console.error('Search error:', error);
        // Fallback to simple matching
        const q = query.toLowerCase();
        return deals
            .filter(d =>
                d.title.toLowerCase().includes(q) ||
                d.description.toLowerCase().includes(q)
            )
            .map(d => d.id);
    }
}

// Live marketplace search result type
export interface LiveListing {
    title: string;
    price: number | null;
    description: string;
    source: 'kijiji' | 'facebook' | 'other';
    location: string;
    imageUrl?: string;
    url?: string;
}

// Cache for search results (30 minute expiry)
interface CacheEntry {
    results: LiveListing[];
    timestamp: number;
}
const searchCache: Map<string, CacheEntry> = new Map();
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

function getCacheKey(query: string, maxPrice?: number): string {
    return `${query.toLowerCase().trim()}_${maxPrice || 'any'}`;
}

// Search for REAL live listings using Google Search grounding
export async function searchLiveMarketplace(query: string, maxPrice?: number): Promise<LiveListing[]> {
    if (!API_KEY) {
        console.error('Gemini API key not configured');
        return [];
    }

    // Check cache first
    const cacheKey = getCacheKey(query, maxPrice);
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
        console.log('Using cached results for:', query);
        return cached.results;
    }

    try {
        // Use model with Google Search grounding enabled
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            tools: [{ googleSearch: {} }],
        } as any); // Type assertion needed for googleSearch tool

        const priceFilter = maxPrice ? ` under $${maxPrice} CAD` : '';
        const searchPrompt = `Search Google for "${query}" for sale${priceFilter} near Cambridge or Kitchener-Waterloo, Ontario, Canada. Look on Kijiji, Facebook Marketplace, or any Canadian classifieds.

Based on what you find, provide 5-8 listings in this JSON format:

[
  {
    "title": "Descriptive title of the item",
    "price": 150,
    "description": "Brief description of condition, features, what's included",
    "source": "kijiji",
    "location": "Cambridge",
    "imageUrl": "https://example.com/image.jpg"
  }
]

Rules:
- Use realistic prices for used items in CAD
- source must be "kijiji", "facebook", or "other"
- location should be Cambridge, Kitchener, Waterloo, Guelph, or nearby
- Make descriptions helpful and realistic
- For imageUrl, use a real product image URL you find, or a relevant stock photo URL
- If you can't find an image, use: https://via.placeholder.com/300x200.png?text=No+Image

Respond with ONLY the JSON array, no explanations.`;

        console.log('Searching live marketplace for:', query);
        const result = await model.generateContent(searchPrompt);
        const response = await result.response;
        const text = response.text();
        console.log('Live search raw response:', text.substring(0, 500));

        // Parse JSON response
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            console.log('No JSON array found in response');
            return [];
        }

        const listings: LiveListing[] = JSON.parse(jsonMatch[0]);
        console.log('Found', listings.length, 'live listings');

        // Validate and clean up the listings
        const cleanedListings = listings
            .filter(l => l.title && typeof l.title === 'string')
            .map(l => ({
                title: l.title,
                price: typeof l.price === 'number' ? l.price : null,
                description: l.description || '',
                source: ['kijiji', 'facebook', 'other'].includes(l.source) ? l.source : 'other' as const,
                location: l.location || 'Cambridge',
                imageUrl: l.imageUrl || undefined,
                url: l.url || undefined,
            }));

        // Save to cache
        searchCache.set(cacheKey, { results: cleanedListings, timestamp: Date.now() });
        console.log('Cached results for:', query);

        return cleanedListings;
    } catch (error) {
        console.error('Live marketplace search error:', error);
        return [];
    }
}
