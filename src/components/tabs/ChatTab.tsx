import React, { useState, useEffect } from 'react';
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
    const { recentLogs, settings, loadSettings } = useStore();
    const { theme, setTheme } = useTheme();
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [baseUrl, setBaseUrl] = useState('');
    const [modelName, setModelName] = useState('');
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [isTesting, setIsTesting] = useState(false);
    const [testStatus, setTestStatus] = useState<'success' | 'error' | null>(null);

    useEffect(() => {
        if (settings?.apiKey) setApiKey(settings.apiKey);
        if (settings?.baseUrl) setBaseUrl(settings.baseUrl);
        if (settings?.modelName) setModelName(settings.modelName);
    }, [settings]);

    useEffect(() => {
        loadSessions();
    }, [showHistory]);

    const loadSessions = async () => {
        const s = await storage.getSessions();
        setSessions(s.sort((a, b) => b.lastUpdated - a.lastUpdated));
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

        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

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

            const summarize = (label: string, logs: any[]) => {
                if (!logs.length) return `${label}: 数据不足。`;
                const avgP = logs.reduce((a, b) => a + b.values.p, 0) / logs.length;
                const avgC = logs.reduce((a, b) => a + b.values.c, 0) / logs.length;
                const avgS = logs.reduce((a, b) => a + b.values.s, 0) / logs.length;
                return `${label}: 平均 P:${avgP.toFixed(1)} C:${avgC.toFixed(1)} S:${avgS.toFixed(1)}，样本 ${logs.length}。`;
            };

            const summaryContext = [
                summarize("今日", dailyLogs),
                summarize("最近7天", weeklyLogs),
                summarize("最近30天", monthlyLogs)
            ].join('\\n');

            const weeklyContext = summarize("最近7天", weeklyLogs);

            const allEvents = await storage.getEvents();
            const upcomingEvents = allEvents
                .filter(e => e.startTime >= now && e.startTime < now + 24 * 60 * 60 * 1000)
                .sort((a, b) => a.startTime - b.startTime);

            const calendarContext = upcomingEvents.length > 0
                ? upcomingEvents.map(e => `[${new Date(e.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}] ${e.title}`).join('\n')
                : "No events in next 24h.";

            const systemPrompt = generateSystemPrompt(recentLogs, weeklyContext, calendarContext, summaryContext);
            const aiResponseContent = await sendMessageToAI([...messages, userMsg], apiKey, systemPrompt, baseUrl, modelName);

            const aiMsg: Message = {
                id: uuidv4(),
                role: 'assistant',
                content: aiResponseContent,
                timestamp: Date.now()
            };

            setMessages(prev => [...prev, aiMsg]);

            // Auto-save session
            // In a real app, we'd manage session ID persistence
            const session: ChatSession = {
                id: uuidv4(), // Ideally keep same ID for current session
                startTime: messages.length > 0 ? messages[0].timestamp : Date.now(),
                lastUpdated: Date.now(),
                messages: [...messages, userMsg, aiMsg],
                archived: false
            };
            await storage.saveSession(session);

        } catch {
            const errorMsg: Message = {
                id: uuidv4(),
                role: 'system',
                content: "Error: Failed to connect to Neural Twin. Check API Key.",
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    const saveSettings = async () => {
        await storage.saveSettings({ ...settings!, apiKey, baseUrl, modelName });
        await loadSettings();
        setShowSettings(false);
    };

    const loadSession = (session: ChatSession) => {
        setMessages(session.messages);
        setShowHistory(false);
    };

    return (
        <div className="h-full relative overflow-hidden">
            <ChatInterface
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                onOpenSettings={() => setShowSettings(true)}
                onOpenHistory={() => setShowHistory(true)}
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
                                <button
                                    key={session.id}
                                    onClick={() => loadSession(session)}
                                    className="w-full text-left p-4 rounded-xl bg-background border border-white/5 hover:border-blue-500/30 transition-all group"
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
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
