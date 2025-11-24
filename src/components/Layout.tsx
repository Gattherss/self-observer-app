import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, BarChart2, Brain, Calendar } from 'lucide-react';
import { useStore } from '../store';
import { cn } from '../utils/cn';
import { UI_TEXT } from '../utils/constants';
import { soundService } from '../services/sound';
import { useTheme } from '../context/ThemeContext';

interface LayoutProps {
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { activeTab, setActiveTab } = useStore();
    const { theme, setTheme, fontScale, setFontScale } = useTheme();
    const [showThemePanel, setShowThemePanel] = React.useState(false);

    const tabs = [
        { id: 0, label: UI_TEXT.tabs.record, icon: Activity },
        { id: 1, label: UI_TEXT.tabs.analytics, icon: BarChart2 },
        { id: 2, label: UI_TEXT.tabs.chat, icon: Brain },
        { id: 3, label: UI_TEXT.tabs.calendar, icon: Calendar },
    ];

    // Swipe Logic
    const [touchStart, setTouchStart] = React.useState<number | null>(null);
    const [touchEnd, setTouchEnd] = React.useState<number | null>(null);
    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe && activeTab < tabs.length - 1) {
            setActiveTab(activeTab + 1);
            soundService.playClick();
        }
        if (isRightSwipe && activeTab > 0) {
            setActiveTab(activeTab - 1);
            soundService.playClick();
        }
    };

    return (
        <div className="min-h-screen w-full bg-background flex justify-center overflow-hidden relative">
            {/* Theme toggle button - Hide on Chat tab to avoid overlap with settings */}
            {activeTab !== 2 && (
                <div className="absolute top-3 right-4 z-40">
                    <button
                        onClick={() => setShowThemePanel(!showThemePanel)}
                        className="px-3 py-2 rounded-lg bg-surface border border-white/10 text-xs text-gray-200 hover:bg-white/5 transition-all shadow-sm"
                    >
                        主题
                    </button>
                    {showThemePanel && (
                        <div className="mt-2 w-56 bg-surface border border-white/10 rounded-xl p-3 shadow-xl space-y-3">
                            <div className="text-[11px] text-gray-400">色彩</div>
                            <div className="flex gap-2 flex-wrap">
                                {(['cyberpunk', 'zen', 'minimalist', 'neon', 'sunset', 'forest', 'ocean', 'coffee', 'white', 'darkgrey', 'aurora'] as const).map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setTheme(t)}
                                        className={cn(
                                            "px-3 py-2 rounded-lg text-xs font-bold capitalize border transition-all",
                                            theme === t ? "bg-primary text-black border-primary" : "bg-transparent text-gray-400 border-white/10 hover:border-white/30"
                                        )}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                            <div className="text-[11px] text-gray-400">字号</div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="range"
                                    min={0.9}
                                    max={1.3}
                                    step={0.05}
                                    value={fontScale}
                                    onChange={(e) => setFontScale(Number(e.target.value))}
                                    className="flex-1"
                                />
                                <span className="text-xs text-gray-300">{(fontScale * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
            {/* Mobile Container */}
            <div className="w-full max-w-[480px] h-screen bg-surface relative flex flex-col shadow-2xl overflow-hidden">

                {/* Main Content Area */}
                <main
                    className="flex-1 overflow-hidden relative"
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                >
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2 }}
                            className="h-full w-full"
                        >
                            {children}
                        </motion.div>
                    </AnimatePresence>
                </main>

                {/* Bottom Navigation */}
                <nav className="h-20 bg-surface/80 backdrop-blur-md border-t border-white/5 flex items-center justify-around px-2 pb-safe">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            // ... inside component ...

                            // ... inside component ...

                            <button
                                key={tab.id}
                                onClick={() => {
                                    setActiveTab(tab.id);
                                    soundService.playClick();
                                }}
                                className={cn(
                                    "flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-all duration-300",
                                    isActive ? "text-primary" : "text-muted hover:text-white"
                                )}
                            >
                                <div className={cn(
                                    "p-2 rounded-full transition-all duration-300",
                                    isActive ? "bg-primary/10 scale-110" : "bg-transparent"
                                )}>
                                    <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                                </div>
                                <span className="text-[10px] font-medium mt-1 opacity-80">
                                    {tab.label}
                                </span>
                            </button>
                        );
                    })}
                </nav>
            </div>
        </div>
    );
};
