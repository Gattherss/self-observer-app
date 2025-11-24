import { create } from 'zustand';
import type { TrinityValue, LogEntry, ChatSession, AppSettings } from '../types';
import { storage } from '../services/storage';

interface AppState {
    // UI State
    activeTab: number;
    setActiveTab: (index: number) => void;

    // Record State
    currentValues: TrinityValue;
    setTrinityValue: (key: keyof TrinityValue, value: number) => void;
    resetValues: () => void;

    // Data State
    recentLogs: LogEntry[];
    refreshLogs: () => Promise<void>;

    // Chat State
    currentSession: ChatSession | null;
    setCurrentSession: (session: ChatSession | null) => void;

    // Settings
    settings: AppSettings | null;
    loadSettings: () => Promise<void>;
}

export const useStore = create<AppState>()((set) => ({
    // UI
    activeTab: 0,
    setActiveTab: (index) => set({ activeTab: index }),

    // Record
    currentValues: { p: 5, c: 5, s: 5 },
    setTrinityValue: (key, value) =>
        set((state) => ({
            currentValues: { ...state.currentValues, [key]: value }
        })),
    resetValues: () => set({ currentValues: { p: 5, c: 5, s: 5 } }),

    // Data
    recentLogs: [],
    refreshLogs: async () => {
        const end = Date.now();
        const start = end - 7 * 24 * 60 * 60 * 1000;
        const logs = await storage.getLogs(start, end);
        set({ recentLogs: logs });
    },

    // Chat
    currentSession: null,
    setCurrentSession: (session) => set({ currentSession: session }),

    // Settings
    settings: null,
    loadSettings: async () => {
        const settings = await storage.getSettings();
        if (settings) {
            set({ settings });
        } else {
            set({ settings: { themeMode: 'dark' } });
        }
    }
}));
