import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Save, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useStore } from '../../store';
import { RadarDisplay } from '../RadarDisplay';
import { InputSlider } from '../InputSlider';
import { storage } from '../../services/storage';
import type { TrendDirection } from '../../types';
import { cn } from '../../utils/cn';
import { UI_TEXT, SLIDER_DESCRIPTIONS } from '../../utils/constants';
import { soundService } from '../../services/sound';

export const RecordTab: React.FC = () => {
    const { currentValues, setTrinityValue, resetValues, refreshLogs } = useStore();
    const [trend, setTrend] = useState<TrendDirection>('flat');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [flashSave, setFlashSave] = useState(false);
    const [eventTitle, setEventTitle] = useState('');
    const [eventDesc, setEventDesc] = useState('');
    const [eventTime, setEventTime] = useState(() => {
        const now = new Date();
        return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    });
    const [showModal, setShowModal] = useState(false);

    const availableTags = ['刚醒', '压力大', '运动后', '深度工作', '社交中', '疲劳', '焦虑', '兴奋', '无聊'];

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const tagList = [...selectedTags];
            const timestamp = Date.now();

            const logId = await storage.saveLog({
                timestamp,
                values: currentValues,
                tags: tagList,
                trend: trend,
                note: eventDesc || ''
            });

            // 可选事件存储
            if (eventTitle.trim()) {
                const [h, m] = eventTime.split(':').map(v => parseInt(v, 10));
                const start = new Date(timestamp);
                start.setHours(h || 0, m || 0, 0, 0);
                const startTime = start.getTime();
                const endTime = startTime + 60 * 60 * 1000;
                await storage.saveEvent({
                    id: crypto.randomUUID ? crypto.randomUUID() : `${timestamp}`,
                    title: eventTitle.trim(),
                    startTime,
                    endTime,
                    description: eventDesc.trim(),
                    logId
                });
            }

            if (navigator.vibrate) navigator.vibrate(50);
            soundService.playSuccess();

            await refreshLogs();
            resetValues();
            setTrend('flat');
            setSelectedTags([]);
            setEventTitle('');
            setEventDesc('');
            setFlashSave(true);
            setTimeout(() => setFlashSave(false), 1000);

            // 通知日历刷新
            window.dispatchEvent(new Event('data-updated'));
        } catch (error) {
            console.error("Failed to save log", error);
            soundService.playError();
        } finally {
            setIsSaving(false);
        }
    };

    const toggleTag = (tag: string) => {
        if (selectedTags.includes(tag)) {
            setSelectedTags(selectedTags.filter(t => t !== tag));
        } else {
            setSelectedTags([...selectedTags, tag]);
        }
    };

    const getSliderStatus = (type: 'p' | 'c' | 's', value: number) => {
        const rounded = Math.round(value);
        // @ts-ignore
        return SLIDER_DESCRIPTIONS[type][rounded] || '';
    };

    return (
        <div className="h-full overflow-y-auto no-scrollbar pb-24 px-6 pt-8">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                    Impulse Observer
                </h1>
                <div className="w-8 h-8 rounded-full bg-surface border border-white/10 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                </div>
            </div>

            {/* Radar Chart */}
            <div className="flex justify-center mb-10">
                <RadarDisplay values={currentValues} size={280} />
            </div>

            {/* Sliders */}
            <div className="space-y-2 mb-8">
                <InputSlider
                    label="生理觉醒 (Physical)"
                    value={currentValues.p}
                    onChange={(v) => setTrinityValue('p', v)}
                    color="#22c55e"
                    statusText={getSliderStatus('p', currentValues.p)}
                />
                <InputSlider
                    label="认知专注 (Cognitive)"
                    value={currentValues.c}
                    onChange={(v) => setTrinityValue('c', v)}
                    color="#3b82f6"
                    statusText={getSliderStatus('c', currentValues.c)}
                />
                <InputSlider
                    label="冲动强度 (Impulse)"
                    value={currentValues.s}
                    onChange={(v) => setTrinityValue('s', v)}
                    color="#ef4444"
                    statusText={getSliderStatus('s', currentValues.s)}
                />
            </div>

            {/* Trend */}
            <div className="mb-8">
                <h3 className="text-sm font-medium text-gray-400 mb-3">趋势 (Trend)</h3>
                <div className="flex bg-surface rounded-lg p-1 border border-white/5">
                    {[
                        { id: 'up', icon: TrendingUp, label: UI_TEXT.record.trend.up },
                        { id: 'flat', icon: Minus, label: UI_TEXT.record.trend.flat },
                        { id: 'down', icon: TrendingDown, label: UI_TEXT.record.trend.down }
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setTrend(item.id as TrendDirection)}
                            className={cn(
                                "flex-1 flex items-center justify-center py-2 rounded-md transition-all",
                                trend === item.id ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                            )}
                        >
                            <item.icon size={18} className="mr-2" />
                            <span className="text-sm sm:text-xs font-medium">{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Tags */}
            <div className="mb-10">
                <h3 className="text-sm font-medium text-gray-400 mb-3">标签 (可选)</h3>
                <div className="flex flex-wrap gap-2">
                    {availableTags.map(tag => (
                        <button
                            key={tag}
                            onClick={() => toggleTag(tag)}
                            className={cn(
                                "px-4 py-2 sm:px-3 sm:py-1.5 rounded-full text-sm sm:text-xs font-medium border transition-all",
                                selectedTags.includes(tag)
                                    ? "bg-white text-black border-white"
                                    : "bg-transparent text-gray-400 border-white/10 hover:border-white/30"
                            )}
                        >
                            {tag}
                        </button>
                    ))}
                </div>
            </div>

            {/* Save Button */}
            <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowModal(true)}
                disabled={isSaving}
                className={cn(
                    "w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center shadow-lg transition-all",
                    flashSave || isSaving
                        ? "bg-green-600 text-white"
                        : "bg-blue-500 text-white hover:bg-blue-400"
                )}
            >
                {isSaving ? (
                    <span>{UI_TEXT.record.saving}</span>
                ) : (
                    <>
                        <Save size={20} className="mr-2" />
                        <span>{UI_TEXT.record.save}</span>
                    </>
                )}
            </motion.button>

            {/* 保存弹窗 */}
            {showModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
                    <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-white/10">
                            <div className="text-lg font-bold text-white">确认并补充</div>
                            <div className="text-sm sm:text-xs text-gray-500 mt-1">可填写事件/备注，或调整标签后保存</div>
                        </div>
                        <div className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: '70vh' }}>
                            <div className="text-sm text-gray-300">时间：{new Date().toLocaleString()}</div>
                            <div className="grid grid-cols-3 gap-2 text-sm sm:text-xs">
                                <div className="bg-white/5 rounded-lg p-2 border border-white/10 text-center">
                                    <div className="text-gray-400">P</div>
                                    <div className="text-green-400 text-lg font-bold">{currentValues.p.toFixed(1)}</div>
                                </div>
                                <div className="bg-white/5 rounded-lg p-2 border border-white/10 text-center">
                                    <div className="text-gray-400">C</div>
                                    <div className="text-blue-400 text-lg font-bold">{currentValues.c.toFixed(1)}</div>
                                </div>
                                <div className="bg-white/5 rounded-lg p-2 border border-white/10 text-center">
                                    <div className="text-gray-400">S</div>
                                    <div className="text-red-400 text-lg font-bold">{currentValues.s.toFixed(1)}</div>
                                </div>
                            </div>

                            <div>
                                <div className="text-sm sm:text-xs text-gray-400 mb-2">标签（可选）</div>
                                <div className="flex flex-wrap gap-2">
                                    {availableTags.map(tag => (
                                        <button
                                            key={tag}
                                            onClick={() => toggleTag(tag)}
                                            className={cn(
                                                "px-4 py-2 sm:px-3 sm:py-1.5 rounded-full text-sm sm:text-xs font-medium border transition-all",
                                                selectedTags.includes(tag)
                                                    ? "bg-white text-black border-white"
                                                    : "bg-transparent text-gray-400 border-white/10 hover:border-white/30"
                                            )}
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="text-sm sm:text-xs text-gray-400">事件（可选）</div>
                                <input
                                    value={eventTitle}
                                    onChange={e => setEventTitle(e.target.value)}
                                    className="w-full bg-background border border-white/10 rounded-lg p-2 text-sm"
                                    placeholder="事件标题（如会议、运动）"
                                />
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="time"
                                        value={eventTime}
                                        onChange={e => setEventTime(e.target.value)}
                                        className="bg-background border border-white/10 rounded-lg p-2 text-sm"
                                    />
                                    <input
                                        value={eventDesc}
                                        onChange={e => setEventDesc(e.target.value)}
                                        className="bg-background border border-white/10 rounded-lg p-2 text-sm"
                                        placeholder="备注 / 影响"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-white/10 grid grid-cols-3 gap-2">
                            <button
                                className="py-3 rounded-lg bg-gray-800 text-gray-300 text-sm"
                                onClick={() => setShowModal(false)}
                            >
                                返回
                            </button>
                            <button
                                className="py-3 rounded-lg bg-gray-700 text-gray-300 text-sm"
                                onClick={() => {
                                    setShowModal(false);
                                    resetValues();
                                    setSelectedTags([]);
                                    setEventTitle('');
                                    setEventDesc('');
                                }}
                            >
                                放弃
                            </button>
                            <button
                                className="py-3 rounded-lg bg-blue-500 text-white text-sm hover:bg-blue-400"
                                onClick={async () => {
                                    await handleSave();
                                    setShowModal(false);
                                }}
                            >
                                保存
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
