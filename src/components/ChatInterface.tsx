import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, Settings, History, Plus } from 'lucide-react';
import type { Message } from '../types';
import { cn } from '../utils/cn';

interface ChatInterfaceProps {
    messages: Message[];
    onSendMessage: (content: string) => void;
    isLoading: boolean;
    onOpenSettings: () => void;
    onOpenHistory: () => void;
    animateLast: boolean;
    onNewSession: () => void;
}

const TypewriterText: React.FC<{ text: string }> = ({ text }) => {
    const [displayedText, setDisplayedText] = useState('');

    useEffect(() => {
        let i = 0;
        const timer = setInterval(() => {
            setDisplayedText(text.substring(0, i + 1));
            i++;
            if (i > text.length) clearInterval(timer);
        }, 20); // Speed
        return () => clearInterval(timer);
    }, [text]);

    return <div className="whitespace-pre-wrap">{displayedText}</div>;
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
    messages,
    onSendMessage,
    isLoading,
    onOpenSettings,
    onOpenHistory,
    animateLast,
    onNewSession
}) => {
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;
        onSendMessage(input);
        setInput('');
    };

    return (
        <div className="flex flex-col h-full relative">
            {/* Header */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-white/5 bg-surface/50 backdrop-blur-sm z-10 absolute top-0 w-full">
                <div className="flex items-center gap-1">
                    <button onClick={onOpenHistory} className="p-2 text-gray-400 hover:text-white">
                        <History size={20} />
                    </button>
                    <button onClick={onNewSession} className="px-3 py-2 text-xs rounded-lg bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10">
                        <Plus size={14} className="inline mr-1" /> 新会话
                    </button>
                </div>
                <span className="text-sm font-bold tracking-widest text-gray-300">NEURAL TWIN</span>
                <button onClick={onOpenSettings} className="p-2 text-gray-400 hover:text-white">
                    <Settings size={20} />
                </button>
            </div>

            {/* Messages */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto pt-16 pb-20 px-4 space-y-6 no-scrollbar"
            >
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-600 space-y-4">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center animate-pulse-slow">
                            <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        </div>
                        <p className="text-sm">System Online. Awaiting Input.</p>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                            "flex flex-col max-w-[85%]",
                            msg.role === 'user' ? "self-end items-end" : "self-start items-start"
                        )}
                    >
                        <div className={cn(
                            "px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm",
                            msg.role === 'user'
                                ? "bg-blue-600 text-white rounded-tr-none"
                                : "bg-surface border border-white/10 text-gray-200 rounded-tl-none"
                        )}>
                            {msg.role === 'assistant' && idx === messages.length - 1 && animateLast ? (
                                <TypewriterText text={msg.content} />
                            ) : (
                                <div className="whitespace-pre-wrap">{msg.content}</div>
                            )}
                        </div>
                        <span className="text-[10px] text-gray-600 mt-1 px-1">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </motion.div>
                ))}

                {isLoading && (
                    <div className="self-start flex items-center space-x-2 px-4 py-3 bg-surface rounded-2xl rounded-tl-none border border-white/10">
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="absolute bottom-0 w-full bg-surface/80 backdrop-blur-md border-t border-white/5 p-4 pb-safe">
                <form onSubmit={handleSubmit} className="relative flex items-center">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type a message..."
                        className="w-full bg-background border border-white/10 rounded-full py-3 pl-5 pr-12 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-all"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 p-2 bg-blue-600 rounded-full text-white disabled:opacity-50 disabled:bg-gray-700 transition-all"
                    >
                        <Send size={16} />
                    </button>
                </form>
            </div>
        </div>
    );
};
