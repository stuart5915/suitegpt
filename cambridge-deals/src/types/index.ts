// Core type definitions for the Deal Tracker app

export interface Deal {
  id: string;
  title: string;
  description: string;
  price?: number;
  originalPrice?: number;
  discount?: string;
  source: 'kijiji' | 'facebook' | 'manual';
  category: string;
  location: CambridgeArea;
  imageUri?: string;
  expiresAt?: Date;
  createdAt: Date;
  isActive: boolean;
}

export type CambridgeArea = 'galt' | 'preston' | 'hespeler' | 'cambridge-general';

export interface WatchListItem {
  id: string;
  keyword: string;
  category?: string;
  maxPrice?: number;
  areas: CambridgeArea[];
  createdAt: Date;
  isActive: boolean;
}

export interface UserPreferences {
  notificationsEnabled: boolean;
  notificationTime: string; // HH:MM format
  preferredAreas: CambridgeArea[];
  watchList: WatchListItem[];
}

export interface GeminiAnalysisResult {
  success: boolean;
  deal?: {
    title: string;
    description: string;
    price?: number;
    originalPrice?: number;
    category: string;
    location?: string;
    expiresAt?: string;
  };
  error?: string;
  confidence: number;
}

export interface AppState {
  deals: Deal[];
  preferences: UserPreferences;
  isLoading: boolean;
  lastSync: Date | null;
}
