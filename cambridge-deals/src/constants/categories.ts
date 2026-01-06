// Predefined categories for deal classification

export const CATEGORIES = {
    RESTAURANTS: 'restaurants',
    GROCERIES: 'groceries',
    ELECTRONICS: 'electronics',
    FURNITURE: 'furniture',
    SPORTS: 'sports',
    VEHICLES: 'vehicles',
    CLOTHING: 'clothing',
    HOME_GARDEN: 'home-garden',
    SERVICES: 'services',
    OTHER: 'other',
} as const;

export type CategoryType = typeof CATEGORIES[keyof typeof CATEGORIES];

export const CATEGORY_LABELS: Record<CategoryType, string> = {
    [CATEGORIES.RESTAURANTS]: '🍔 Restaurants',
    [CATEGORIES.GROCERIES]: '🛒 Groceries',
    [CATEGORIES.ELECTRONICS]: '📱 Electronics',
    [CATEGORIES.FURNITURE]: '🛋️ Furniture',
    [CATEGORIES.SPORTS]: '⚽ Sports',
    [CATEGORIES.VEHICLES]: '🚗 Vehicles',
    [CATEGORIES.CLOTHING]: '👕 Clothing',
    [CATEGORIES.HOME_GARDEN]: '🏡 Home & Garden',
    [CATEGORIES.SERVICES]: '🔧 Services',
    [CATEGORIES.OTHER]: '📦 Other',
};

export const CAMBRIDGE_AREAS = {
    GALT: 'galt',
    PRESTON: 'preston',
    HESPELER: 'hespeler',
    GENERAL: 'cambridge-general',
} as const;

export const AREA_LABELS: Record<string, string> = {
    [CAMBRIDGE_AREAS.GALT]: '📍 Galt',
    [CAMBRIDGE_AREAS.PRESTON]: '📍 Preston',
    [CAMBRIDGE_AREAS.HESPELER]: '📍 Hespeler',
    [CAMBRIDGE_AREAS.GENERAL]: '📍 Cambridge',
};
