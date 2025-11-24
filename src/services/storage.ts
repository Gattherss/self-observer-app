import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { LogEntry, ChatSession, AppSettings, CalendarEvent } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface NeuroTrackerDB extends DBSchema {
    logs: {
        key: string;
        value: LogEntry;
        indexes: { 'by-timestamp': number };
    };
    sessions: {
        key: string;
        value: ChatSession;
        indexes: { 'by-startTime': number };
    };
    settings: {
        key: string;
        value: AppSettings;
    };
    events: {
        key: string;
        value: CalendarEvent;
        indexes: { 'by-startTime': number };
    };
}

const DB_NAME = 'neuro-tracker-db';
const DB_VERSION = 2; // Increment version for new store

class StorageService {
    private dbPromise: Promise<IDBPDatabase<NeuroTrackerDB>>;

    constructor() {
        this.dbPromise = openDB<NeuroTrackerDB>(DB_NAME, DB_VERSION, {
            upgrade(db, _oldVersion, _newVersion, _transaction) {
                // Logs store
                if (!db.objectStoreNames.contains('logs')) {
                    const logStore = db.createObjectStore('logs', { keyPath: 'id' });
                    logStore.createIndex('by-timestamp', 'timestamp');
                }

                // Sessions store
                if (!db.objectStoreNames.contains('sessions')) {
                    const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
                    sessionStore.createIndex('by-startTime', 'startTime');
                }

                // Settings store
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }

                // Events store (New in v2)
                if (!db.objectStoreNames.contains('events')) {
                    const eventStore = db.createObjectStore('events', { keyPath: 'id' });
                    eventStore.createIndex('by-startTime', 'startTime');
                }
            },
        });
    }

    // --- Logs ---

    async saveLog(entry: Omit<LogEntry, 'id'>): Promise<string> {
        const db = await this.dbPromise;
        const id = uuidv4();
        const newEntry: LogEntry = { ...entry, id };
        await db.put('logs', newEntry);
        return id;
    }

    async getLogs(startTime: number, endTime: number): Promise<LogEntry[]> {
        const db = await this.dbPromise;
        const range = IDBKeyRange.bound(startTime, endTime);
        return db.getAllFromIndex('logs', 'by-timestamp', range);
    }

    async getAllLogs(): Promise<LogEntry[]> {
        const db = await this.dbPromise;
        return db.getAllFromIndex('logs', 'by-timestamp');
    }

    async deleteLog(id: string): Promise<void> {
        const db = await this.dbPromise;
        await db.delete('logs', id);
    }

    // --- Sessions ---

    async saveSession(session: ChatSession): Promise<void> {
        const db = await this.dbPromise;
        await db.put('sessions', session);
    }

    async getSessions(): Promise<ChatSession[]> {
        const db = await this.dbPromise;
        return db.getAllFromIndex('sessions', 'by-startTime');
    }

    async getSession(id: string): Promise<ChatSession | undefined> {
        const db = await this.dbPromise;
        return db.get('sessions', id);
    }

    // --- Settings ---

    async saveSettings(settings: AppSettings): Promise<void> {
        const db = await this.dbPromise;
        await db.put('settings', { ...settings, key: 'main' });
    }

    async getSettings(): Promise<AppSettings | undefined> {
        const db = await this.dbPromise;
        return db.get('settings', 'main');
    }

    // --- Events ---

    async saveEvent(event: CalendarEvent): Promise<void> {
        const db = await this.dbPromise;
        await db.put('events', event);
    }

    async getEvents(): Promise<CalendarEvent[]> {
        const db = await this.dbPromise;
        return db.getAllFromIndex('events', 'by-startTime');
    }


}

export const storage = new StorageService();
