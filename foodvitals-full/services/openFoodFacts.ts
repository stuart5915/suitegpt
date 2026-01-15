/**
 * Open Food Facts API Service
 * Free, open-source food database for barcode lookups
 */

interface OpenFoodFactsProduct {
    product_name?: string;
    brands?: string;
    nutriments?: {
        'energy-kcal_100g'?: number;
        'energy-kcal_serving'?: number;
        proteins_100g?: number;
        proteins_serving?: number;
        carbohydrates_100g?: number;
        carbohydrates_serving?: number;
        fat_100g?: number;
        fat_serving?: number;
        fiber_100g?: number;
        fiber_serving?: number;
        sodium_100g?: number;
        sodium_serving?: number;
    };
    serving_size?: string;
    serving_quantity?: number;
}

interface BarcodeResult {
    found: boolean;
    name?: string;
    brand?: string;
    servingSize?: string;
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    fiber_g?: number;
    sodium_mg?: number;
}

/**
 * Lookup a barcode in the Open Food Facts database
 */
export const lookupBarcode = async (barcode: string): Promise<BarcodeResult> => {
    try {
        console.log('[OpenFoodFacts] Looking up barcode:', barcode);

        const response = await fetch(
            `https://world.openfoodfacts.net/api/v2/product/${barcode}`,
            {
                headers: {
                    'User-Agent': 'FoodVitalsAI/1.0 (iOS; Android)',
                },
            }
        );

        const data = await response.json();

        if (data.status !== 1 || !data.product) {
            console.log('[OpenFoodFacts] Product not found');
            return { found: false };
        }

        const product: OpenFoodFactsProduct = data.product;
        const n = product.nutriments || {};

        // Prefer serving values if available, otherwise use per 100g
        const hasServing = n['energy-kcal_serving'] !== undefined;

        const result: BarcodeResult = {
            found: true,
            name: product.product_name || 'Unknown Product',
            brand: product.brands,
            servingSize: product.serving_size || '100g',
            calories: Math.round(hasServing ? (n['energy-kcal_serving'] || 0) : (n['energy-kcal_100g'] || 0)),
            protein_g: Math.round(hasServing ? (n.proteins_serving || 0) : (n.proteins_100g || 0)),
            carbs_g: Math.round(hasServing ? (n.carbohydrates_serving || 0) : (n.carbohydrates_100g || 0)),
            fat_g: Math.round(hasServing ? (n.fat_serving || 0) : (n.fat_100g || 0)),
            fiber_g: Math.round(hasServing ? (n.fiber_serving || 0) : (n.fiber_100g || 0)),
            sodium_mg: Math.round(hasServing ? ((n.sodium_serving || 0) * 1000) : ((n.sodium_100g || 0) * 1000)),
        };

        console.log('[OpenFoodFacts] Found product:', result.name, result.calories, 'cal');
        return result;
    } catch (error) {
        console.error('[OpenFoodFacts] Error:', error);
        return { found: false };
    }
};
