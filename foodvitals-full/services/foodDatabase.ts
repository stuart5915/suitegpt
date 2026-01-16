/**
 * SUITE Food Database Service
 * Tiered lookup system to minimize AI API costs:
 *
 * Tier 1: Local cache (FREE - instant)
 * Tier 2: USDA FoodData Central API (FREE - 300k+ foods)
 * Tier 3: AI fallback (PAID - only for unknown items)
 *
 * This can reduce API costs by 80-90%!
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ParsedFoodItem } from './gemini';

// USDA FoodData Central API (FREE!)
const USDA_API_KEY = 'DEMO_KEY'; // Get a free key at https://fdc.nal.usda.gov/api-key-signup.html
const USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1';

// Cache keys
const FOOD_CACHE_KEY = 'foodvitals_food_cache';
const PHOTO_CACHE_KEY = 'foodvitals_photo_cache';

// Types
interface CachedFood {
  name: string;
  normalizedName: string;
  nutrition: ParsedFoodItem;
  source: 'cache' | 'usda' | 'ai';
  cachedAt: number;
}

interface FoodCache {
  [normalizedName: string]: CachedFood;
}

interface PhotoCache {
  [hash: string]: {
    result: ParsedFoodItem[];
    cachedAt: number;
  };
}

// ============================================
// CACHE MANAGEMENT
// ============================================

let memoryCache: FoodCache = {};
let photoCacheMemory: PhotoCache = {};

// Load cache from storage on init
export async function initFoodCache(): Promise<void> {
  try {
    const cached = await AsyncStorage.getItem(FOOD_CACHE_KEY);
    if (cached) {
      memoryCache = JSON.parse(cached);
      console.log(`Loaded ${Object.keys(memoryCache).length} cached foods`);
    }

    const photoCached = await AsyncStorage.getItem(PHOTO_CACHE_KEY);
    if (photoCached) {
      photoCacheMemory = JSON.parse(photoCached);
      console.log(`Loaded ${Object.keys(photoCacheMemory).length} cached photos`);
    }
  } catch (error) {
    console.error('Failed to load food cache:', error);
  }
}

// Save cache to storage
async function saveCache(): Promise<void> {
  try {
    await AsyncStorage.setItem(FOOD_CACHE_KEY, JSON.stringify(memoryCache));
  } catch (error) {
    console.error('Failed to save food cache:', error);
  }
}

async function savePhotoCache(): Promise<void> {
  try {
    await AsyncStorage.setItem(PHOTO_CACHE_KEY, JSON.stringify(photoCacheMemory));
  } catch (error) {
    console.error('Failed to save photo cache:', error);
  }
}

// Normalize food name for consistent caching
function normalizeFoodName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, ''); // Remove punctuation
}

// Simple hash for photo caching (first 1000 chars of base64)
function hashPhoto(base64: string): string {
  const sample = base64.substring(0, 1000);
  let hash = 0;
  for (let i = 0; i < sample.length; i++) {
    const char = sample.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

// ============================================
// TIER 1: LOCAL CACHE LOOKUP
// ============================================

export function lookupCache(foodName: string): ParsedFoodItem | null {
  const normalized = normalizeFoodName(foodName);
  const cached = memoryCache[normalized];

  if (cached) {
    // Cache entries expire after 30 days
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - cached.cachedAt < thirtyDays) {
      console.log(`Cache HIT: ${foodName}`);
      return cached.nutrition;
    }
  }

  console.log(`Cache MISS: ${foodName}`);
  return null;
}

// Cache a food item (call after AI lookup)
export async function cacheFood(
  foodName: string,
  nutrition: ParsedFoodItem,
  source: 'usda' | 'ai'
): Promise<void> {
  const normalized = normalizeFoodName(foodName);

  memoryCache[normalized] = {
    name: foodName,
    normalizedName: normalized,
    nutrition,
    source,
    cachedAt: Date.now(),
  };

  await saveCache();
  console.log(`Cached: ${foodName} (source: ${source})`);
}

// ============================================
// TIER 2: USDA FOODDATA CENTRAL API
// ============================================

interface USDAFood {
  fdcId: number;
  description: string;
  foodNutrients: {
    nutrientId: number;
    nutrientName: string;
    value: number;
    unitName: string;
  }[];
  servingSize?: number;
  servingSizeUnit?: string;
}

// USDA nutrient IDs
const NUTRIENT_IDS = {
  calories: 1008,
  protein: 1003,
  carbs: 1005,
  fat: 1004,
  fiber: 1079,
  sugar: 2000,
  sodium: 1093,
  potassium: 1092,
  calcium: 1087,
  iron: 1089,
  vitaminC: 1162,
  vitaminD: 1114,
};

export async function lookupUSDA(foodName: string): Promise<ParsedFoodItem | null> {
  try {
    // Search USDA database
    const searchUrl = `${USDA_BASE_URL}/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(foodName)}&pageSize=1`;

    const response = await fetch(searchUrl);
    const data = await response.json();

    if (!data.foods || data.foods.length === 0) {
      console.log(`USDA MISS: ${foodName}`);
      return null;
    }

    const food: USDAFood = data.foods[0];
    console.log(`USDA HIT: ${foodName} → ${food.description}`);

    // Extract nutrients
    const getNutrient = (id: number): number => {
      const nutrient = food.foodNutrients.find(n => n.nutrientId === id);
      return nutrient?.value || 0;
    };

    // Parse quantity from input (e.g., "2 eggs" → quantity: 2)
    const quantityMatch = foodName.match(/^(\d+(?:\.\d+)?)\s*/);
    const quantity = quantityMatch ? parseFloat(quantityMatch[1]) : 1;

    const nutrition: ParsedFoodItem = {
      name: food.description,
      quantity: quantity,
      unit: food.servingSizeUnit || 'serving',
      calories: Math.round(getNutrient(NUTRIENT_IDS.calories) * quantity),
      protein_g: Math.round(getNutrient(NUTRIENT_IDS.protein) * quantity * 10) / 10,
      carbs_g: Math.round(getNutrient(NUTRIENT_IDS.carbs) * quantity * 10) / 10,
      fat_g: Math.round(getNutrient(NUTRIENT_IDS.fat) * quantity * 10) / 10,
      fiber_g: Math.round(getNutrient(NUTRIENT_IDS.fiber) * quantity * 10) / 10,
      sodium_mg: Math.round(getNutrient(NUTRIENT_IDS.sodium) * quantity),
      potassium_mg: Math.round(getNutrient(NUTRIENT_IDS.potassium) * quantity),
      calcium_mg: Math.round(getNutrient(NUTRIENT_IDS.calcium) * quantity),
      iron_mg: Math.round(getNutrient(NUTRIENT_IDS.iron) * quantity * 10) / 10,
      vitamin_c_mg: Math.round(getNutrient(NUTRIENT_IDS.vitaminC) * quantity * 10) / 10,
      vitamin_d_mcg: Math.round(getNutrient(NUTRIENT_IDS.vitaminD) * quantity * 10) / 10,
    };

    // Cache the USDA result
    await cacheFood(foodName, nutrition, 'usda');

    return nutrition;
  } catch (error) {
    console.error('USDA lookup failed:', error);
    return null;
  }
}

// ============================================
// PHOTO CACHING
// ============================================

export function lookupPhotoCache(base64: string): ParsedFoodItem[] | null {
  const hash = hashPhoto(base64);
  const cached = photoCacheMemory[hash];

  if (cached) {
    // Photo cache expires after 7 days
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - cached.cachedAt < sevenDays) {
      console.log(`Photo cache HIT`);
      return cached.result;
    }
  }

  console.log(`Photo cache MISS`);
  return null;
}

export async function cachePhotoResult(base64: string, result: ParsedFoodItem[]): Promise<void> {
  const hash = hashPhoto(base64);

  photoCacheMemory[hash] = {
    result,
    cachedAt: Date.now(),
  };

  await savePhotoCache();
  console.log(`Cached photo result`);
}

// ============================================
// TIERED LOOKUP (MAIN FUNCTION)
// ============================================

export interface LookupResult {
  item: ParsedFoodItem;
  source: 'cache' | 'usda' | 'ai';
}

/**
 * Smart tiered lookup for a single food item
 * Returns null if not found in cache or USDA (caller should use AI)
 */
export async function smartLookup(foodName: string): Promise<LookupResult | null> {
  // Tier 1: Check local cache
  const cached = lookupCache(foodName);
  if (cached) {
    return { item: cached, source: 'cache' };
  }

  // Tier 2: Check USDA database
  const usda = await lookupUSDA(foodName);
  if (usda) {
    return { item: usda, source: 'usda' };
  }

  // Tier 3: Return null - caller should use AI
  return null;
}

/**
 * Process multiple food items with smart tiered lookup
 * Returns items found and items that need AI lookup
 */
export async function smartBatchLookup(foodItems: string[]): Promise<{
  found: LookupResult[];
  needsAI: string[];
}> {
  const found: LookupResult[] = [];
  const needsAI: string[] = [];

  for (const item of foodItems) {
    const result = await smartLookup(item);
    if (result) {
      found.push(result);
    } else {
      needsAI.push(item);
    }
  }

  return { found, needsAI };
}

// ============================================
// CACHE STATS (for debugging)
// ============================================

export function getCacheStats(): {
  foodCount: number;
  photoCount: number;
  sources: { cache: number; usda: number; ai: number };
} {
  const sources = { cache: 0, usda: 0, ai: 0 };

  Object.values(memoryCache).forEach(item => {
    if (item.source === 'usda') sources.usda++;
    else if (item.source === 'ai') sources.ai++;
    else sources.cache++;
  });

  return {
    foodCount: Object.keys(memoryCache).length,
    photoCount: Object.keys(photoCacheMemory).length,
    sources,
  };
}

// Pre-populate with common foods to reduce first-time API calls
export async function seedCommonFoods(): Promise<void> {
  const commonFoods = [
    'egg', 'eggs', 'chicken breast', 'rice', 'bread', 'milk',
    'banana', 'apple', 'coffee', 'orange juice', 'oatmeal',
    'salmon', 'broccoli', 'pasta', 'cheese', 'yogurt',
  ];

  console.log('Seeding common foods from USDA...');

  for (const food of commonFoods) {
    if (!lookupCache(food)) {
      await lookupUSDA(food);
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log('Seeding complete');
}
