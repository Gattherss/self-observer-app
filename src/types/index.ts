export interface TrinityValue {
    p: number; // Physical Wakefulness (1-10)
    c: number; // Cognitive Focus (1-10)
    s: number; // Sexual/Impulse (1-10)
}

export type TrendDirection = 'up' | 'flat' | 'down';

export interface LogEntry {
    id: string;
    timestamp: number;
    values: TrinityValue;
    tags: string[];
    trend: TrendDirection;
    note?: string;
}

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}

export interface ChatSession {
    id: string;
    startTime: number;
    lastUpdated: number;
    messages: Message[];
    archived: boolean;
    summary?: string;
}

export interface AppSettings {
    key?: string; // IndexedDB key
    apiKey?: string; // Stored locally
    baseUrl?: string; // Custom API Base URL
    modelName?: string; // Model name (e.g., 'deepseek-chat', 'Qwen/Qwen2.5-Coder-32B-Instruct')
    themeMode: 'dark' | 'light' | 'system';
    userName?: string;
}

export interface CalendarEvent {
    id: string;
    title: string;
    startTime: number;
    endTime: number;
    description?: string;
    logId?: string; // optional: link to a specific log record
}

export interface MonthlyBaseline {
    monthKey: string; // e.g. 2025-11
    values: TrinityValue;
    sample: number;
    lowConfidence?: boolean;
    computedAt: number;
}
