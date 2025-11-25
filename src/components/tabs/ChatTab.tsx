import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { ChatInterface } from '../ChatInterface';
import { sendMessageToAI, generateSystemPrompt } from '../../services/ai';
import type { Message, ChatSession } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '../../services/storage';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useTheme, type Theme } from '../../context/ThemeContext';
import { cn } from '../../utils/cn';
import { startOfDay, endOfDay } from 'date-fns';

export const ChatTab: React.FC = () => {
    const {
        settings,
        loadSettings,
        currentSessionId,
        setCurrentSessionId,
        chatMessages,
        setChatMessages,
        chatIsLoading,
        setChatLoading,
    } = useStore();
    const { theme, setTheme } = useTheme();
    const [animateLast, setAnimateLast] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [baseUrl, setBaseUrl] = useState('');
    const [modelName, setModelName] = useState('');
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [isTesting, setIsTesting] = useState(false);
    const [testStatus, setTestStatus] = useState<'success' | 'error' | null>(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        if (settings?.apiKey) setApiKey(settings.apiKey);
        if (settings?.baseUrl) setBaseUrl(settings.baseUrl);
        if (settings?.modelName) setModelName(settings.modelName);
    }, [settings]);

    useEffect(() => {
        loadSessions(true);
    }, []);

    useEffect(() => {
        if (showHistory) loadSessions();
    }, [showHistory]);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const loadSessions = async (initSelect: boolean = false) => {
        const s = await storage.getSessions();
        const sorted = s.sort((a, b) => b.lastUpdated - a.lastUpdated);
        setSessions(sorted);
        if (initSelect && sorted.length > 0 && !currentSessionId) {
            setCurrentSessionId(sorted[0].id);
            setChatMessages(sorted[0].messages);
            setAnimateLast(false);
        }
    };

    const startNewSession = async () => {
        const now = Date.now();
        const newId = uuidv4();
        const session: ChatSession = {
            id: newId,
            startTime: now,
            lastUpdated: now,
            messages: [],
            archived: false
        };
        await storage.saveSession(session);
        setCurrentSessionId(newId);
        setChatMessages([]);
        setAnimateLast(false);
        loadSessions();
    };

    const ensureSessionId = async (seedTime: number) => {
        if (currentSessionId) return currentSessionId;
        const newId = uuidv4();
        const session: ChatSession = {
            id: newId,
            startTime: seedTime,
            lastUpdated: seedTime,
            messages: [],
            archived: false
        };
        await storage.saveSession(session);
        setCurrentSessionId(newId);
        loadSessions();
        return newId;
    };

    const handleSendMessage = async (content: string) => {
        if (!apiKey) {
            setShowSettings(true);
            return;
        }

        const userMsg: Message = {
            id: uuidv4(),
            role: 'user',
            content,
            timestamp: Date.now()
        };

        setChatMessages([...chatMessages, userMsg]);
        setChatLoading(true);

        try {
            // 1. Gather Context
            const now = Date.now();
            const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
            const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
            const todayStart = startOfDay(new Date()).getTime();
            const todayEnd = endOfDay(new Date()).getTime();

            const dailyLogs = await storage.getLogs(todayStart, todayEnd);
            const weeklyLogs = await storage.getLogs(oneWeekAgo, now);
            const monthlyLogs = await storage.getLogs(oneMonthAgo, now);
            const allLogs = await storage.getAllLogs();
            const allLogsSorted = [...allLogs].sort((a, b) => a.timestamp - b.timestamp);

            const summarize = (label: string, logs: any[]) => {
                if (!logs.length) return `${label}: no data.`;
                const avgP = logs.reduce((a, b) => a + b.values.p, 0) / logs.length;
                const avgC = logs.reduce((a, b) => a + b.values.c, 0) / logs.length;
                const avgS = logs.reduce((a, b) => a + b.values.s, 0) / logs.length;
                return `${label}: avg P:${avgP.toFixed(1)} C:${avgC.toFixed(1)} S:${avgS.toFixed(1)}, samples ${logs.length}.`;
            };

            const rawLogsContext = allLogsSorted.length > 0
                ? allLogsSorted.map(log => {
                    const dt = new Date(log.timestamp);
                    return `[${dt.toISOString()}] P:${log.values.p} C:${log.values.c} S:${log.values.s} tags:${(log.tags || []).join(',') || 'none'} trend:${log.trend || 'n/a'} note:${log.note || ''}`;
                }).join('\n')
                : 'No raw logs.';

            const summaryContext = [
                summarize("Today", dailyLogs),
                summarize("Last 7 days", weeklyLogs),
                summarize("Last 30 days", monthlyLogs),
                summarize("All records", allLogsSorted),
                'RAW LOGS (time ordered):',
                rawLogsContext
            ].join('\n');

            const weeklyContext = summarize("Last 7 days", weeklyLogs);

            const allEvents = await storage.getEvents();
            const allEventsSorted = allEvents.sort((a, b) => a.startTime - b.startTime);

            const calendarContext = allEventsSorted.length > 0
                ? allEventsSorted.map(e => {
                    const dt = new Date(e.startTime);
                    return `[${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}] ${e.title}`;
                }).join('\n')
                : 'No calendar events.';

            const systemPrompt = generateSystemPrompt(allLogsSorted, weeklyContext, calendarContext, summaryContext);
            const aiResponseContent = await sendMessageToAI([...chatMessages, userMsg], apiKey, systemPrompt, baseUrl, modelName);

            const aiMsg: Message = {
                id: uuidv4(),
                role: 'assistant',
                content: aiResponseContent,
                timestamp: Date.now()
            };

            const updatedMessages = [...chatMessages, userMsg, aiMsg];
            setChatMessages(updatedMessages);
            if (isMountedRef.current) setAnimateLast(true);

            // Persist into a single session (not per message)
            const sessionId = await ensureSessionId(userMsg.timestamp);
            const session: ChatSession = {
                id: sessionId,
                startTime: updatedMessages[0]?.timestamp || Date.now(),
                lastUpdated: Date.now(),
                messages: updatedMessages,
                archived: false
            };
            await storage.saveSession(session);
            setCurrentSessionId(sessionId);
            loadSessions();

        } catch {
            const errorMsg: Message = {
                id: uuidv4(),
                role: 'system',
                content: "Error: Failed to connect to Neural Twin. Check API Key.",
                timestamp: Date.now()
            };
            setChatMessages([...chatMessages, errorMsg]);
            if (isMountedRef.current) setAnimateLast(false);
        } finally {
            setChatLoading(false);
        }
    };

    const saveSettings = async () => {
        await storage.saveSettings({ ...settings!, apiKey, baseUrl, modelName });
        await loadSettings();
        setShowSettings(false);
    };

    const loadSession = (session: ChatSession) => {
        setChatMessages(session.messages);
        setCurrentSessionId(session.id);
        setAnimateLast(false); // Do not typewriter historical messages
        setShowHistory(false);
    };

    const deleteSession = async (id: string) => {
        await storage.deleteSession(id);
        // If deleting current session, clear local state
        if (currentSessionId === id) {
            setCurrentSessionId(null);
            setChatMessages([]);
            setAnimateLast(false);
        }
        loadSessions(true);
    };

    return (
        <div className="h-full relative overflow-hidden">
            <ChatInterface
                messages={chatMessages}
                onSendMessage={handleSendMessage}
                isLoading={chatIsLoading}
                onOpenSettings={() => setShowSettings(true)}
                onOpenHistory={() => setShowHistory(true)}
                animateLast={animateLast}
                onNewSession={startNewSession}
            />

            {/* Settings Modal */}
            <AnimatePresence>
                {showSettings && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
                    >
                        <div className="bg-surface w-full max-w-sm rounded-2xl p-6 border border-white/10">
                            <h2 className="text-xl font-bold mb-4">Neural Settings</h2>
                            <div className="mb-4">
                                <label className="block text-xs text-gray-400 mb-2">API BASE URL (Optional)</label>
                                <input
                                    type="text"
                                    value={baseUrl}
                                    onChange={(e) => setBaseUrl(e.target.value)}
                                    className="w-full bg-background border border-white/10 rounded-lg p-3 text-sm mb-4"
                                    placeholder="https://api.deepseek.com"
                                />

                                <label className="block text-xs text-gray-400 mb-2">MODEL NAME (Optional)</label>
                                <input
                                    type="text"
                                    value={modelName}
                                    onChange={(e) => setModelName(e.target.value)}
                                    className="w-full bg-background border border-white/10 rounded-lg p-3 text-sm mb-4"
                                    placeholder="deepseek-reasoner"
                                />

                                <label className="block text-xs text-gray-400 mb-2">API KEY</label>
                                <div className="flex gap-2">
                                    <input
                                        type="password"
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        className="flex-1 bg-background border border-white/10 rounded-lg p-3 text-sm"
                                        placeholder="sk-..."
                                    />
                                    <button
                                        onClick={async () => {
                                            setIsTesting(true);
                                            setTestStatus(null);
                                            try {
                                                await sendMessageToAI(
                                                    [{ id: 'test', role: 'user', content: 'Test connection', timestamp: Date.now() }],
                                                    apiKey,
                                                    'You are a test bot. Reply with "Connection Successful".',
                                                    baseUrl,
                                                    modelName
                                                );
                                                setTestStatus('success');
                                            } catch (error) {
                                                setTestStatus('error');
                                            } finally {
                                                setIsTesting(false);
                                            }
                                        }}
                                        disabled={!apiKey || isTesting}
                                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isTesting ? 'Testing...' : 'Test'}
                                    </button>
                                </div>
                                {testStatus === 'success' && (
                                    <p className="mt-2 text-xs text-green-400">Connection Successful</p>
                                )}
                                {testStatus === 'error' && (
                                    <p className="mt-2 text-xs text-red-400">Connection Failed</p>
                                )}
                            </div>

                            <div className="mb-6">
                                <label className="block text-xs text-gray-400 mb-2">THEME</label>
                                <div className="flex gap-2 flex-wrap">
                                    {(['cyberpunk', 'zen', 'minimalist', 'neon', 'sunset', 'forest', 'ocean', 'coffee', 'white', 'darkgrey', 'aurora'] as Theme[]).map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => setTheme(t)}
                                            className={cn(
                                                "px-3 py-2 rounded-lg text-xs font-bold capitalize border transition-all",
                                                theme === t
                                                    ? "bg-primary text-black border-primary"
                                                    : "bg-transparent text-gray-400 border-white/10 hover:border-white/30"
                                            )}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex space-x-3">
                                <button onClick={() => setShowSettings(false)} className="flex-1 py-3 rounded-lg bg-gray-800 text-gray-400">Cancel</button>
                                <button onClick={saveSettings} className="flex-1 py-3 rounded-lg bg-blue-600 text-white font-bold">Save</button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* History Drawer */}
            <AnimatePresence>
                {showHistory && (
                    <motion.div
                        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="absolute inset-0 bg-surface z-40 flex flex-col"
                    >
                        <div className="h-14 flex items-center justify-between px-4 border-b border-white/5">
                            <span className="font-bold">Memory Archives</span>
                            <button onClick={() => setShowHistory(false)}><X size={24} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {sessions.map(session => (
                                <div
                                    key={session.id}
                                    className="w-full text-left p-4 rounded-xl bg-background border border-white/5 transition-all group flex items-start gap-3"
                                >
                                    <button
                                        onClick={() => loadSession(session)}
                                        className="flex-1 text-left"
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs text-blue-400 font-mono">
                                                {new Date(session.startTime).toLocaleDateString()}
                                            </span>
                                            <span className="text-[10px] text-gray-600">
                                                {new Date(session.startTime).toLocaleTimeString()}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-300 line-clamp-2">
                                            {session.messages.find(m => m.role === 'user')?.content || 'Empty Session'}
                                        </p>
                                    </button>
                                    <button
                                        onClick={() => deleteSession(session.id)}
                                        className="px-2 py-1 text-[11px] text-red-400 hover:text-red-200 border border-red-500/30 rounded-lg"
                                    >
                                        删除
                                    </button>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};











