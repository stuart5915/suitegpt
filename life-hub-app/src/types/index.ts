// Type definitions for Life Hub

export interface LifeMemory {
    id: string;
    user_id: string;
    source_app: SourceApp;
    event_type: string;
    content: string;
    metadata?: Record<string, any>;
    embedding?: number[];
    created_at: string;
}

export type SourceApp =
    | 'trueform'
    | 'opticrep'
    | 'foodvital'
    | 'cheshbon'
    | 'remcast'
    | 'asmr_objects'
    | '3d_minime'
    | 'deals'
    | 'cadence'
    | 'defi_hub';

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    suiteCost?: number;
}

export interface UsageLog {
    id: string;
    user_id: string;
    query: string;
    suite_cost: number;
    created_at: string;
}

export interface UserProfile {
    id: string;
    email: string;
    suiteBalance: number;
    created_at: string;
}

export interface ChatState {
    messages: Message[];
    isLoading: boolean;
    error: string | null;
}
