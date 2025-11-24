import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { storage } from '../../services/storage';
import type { LogEntry, TrendDirection, CalendarEvent } from '../../types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfDay, endOfDay, set } from 'date-fns';
import { Download, Upload, ChevronLeft, ChevronRight, ChevronDown, Trash2, CalendarPlus } from 'lucide-react';
import { exportLogsToCSV, parseCSV } from '../../utils/csv';
import { cn } from '../../utils/cn';

export const CalendarTab: React.FC = () => {
    const { refreshLogs } = useStore();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [dayLogs, setDayLogs] = useState<LogEntry[]>([]);
    const [allMonthLogs, setAllMonthLogs] = useState<LogEntry[]>([]);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [showEvents, setShowEvents] = useState(false);

    const [eventTitle, setEventTitle] = useState('');
    const [eventDesc, setEventDesc] = useState('');
    const [eventTime, setEventTime] = useState('09:00');

    // Load month data when current month changes
    useEffect(() => {
        const start = startOfMonth(currentDate).getTime();
        const end = endOfMonth(currentDate).getTime();
        storage.getLogs(start, end).then(setAllMonthLogs);
        storage.getEvents().then(setEvents);
    }, [currentDate]);

    // Load day logs when selected date changes
    useEffect(() => {
        const dayStart = startOfDay(selectedDate).getTime();
        const dayEnd = endOfDay(selectedDate).getTime();
        storage.getLogs(dayStart, dayEnd).then(setDayLogs);
    }, [selectedDate]);

    const days = eachDayOfInterval({
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate)
    });

    const handleExport = async () => {
        const allLogs = await storage.getAllLogs();
        exportLogsToCSV(allLogs);
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const entries = parseCSV(text);

                let count = 0;
                for (const entry of entries) {
                    if (entry.timestamp && entry.values) {
                        const newLog: Omit<LogEntry, 'id'> = {
                            timestamp: entry.timestamp,
                            values: entry.values!,
                            tags: entry.tags || [],
                            trend: (entry.trend as TrendDirection) || 'flat',
                            note: entry.note
                        };
                        await storage.saveLog(newLog);
                        count++;
                    }
                }
                alert(`Imported ${count} logs.`);
                await refreshLogs();
                // Reload month data
                const start = startOfMonth(currentDate).getTime();
                const end = endOfMonth(currentDate).getTime();
                storage.getLogs(start, end).then(setAllMonthLogs);
            } catch {
                alert('Failed to parse CSV');
            }
        };
        reader.readAsText(file);
    };

    const hasData = (date: Date) => {
        return allMonthLogs.some(l => isSameDay(l.timestamp, date));
    };

    const hasEvent = (date: Date) => {
        return events.some(e => isSameDay(e.startTime, date));
    };

    const dayEvents = events.filter(e => isSameDay(e.startTime, selectedDate));

    const handleDeleteLog = async (logId: string) => {
        if (!window.confirm('确认删除这条记录吗？')) return;
        await storage.deleteLog(logId);
        await refreshLogs();
        // Reload both month and day data
        const start = startOfMonth(currentDate).getTime();
        const end = endOfMonth(currentDate).getTime();
        storage.getLogs(start, end).then(setAllMonthLogs);
        storage.getEvents().then(setEvents);

        const dayStart = startOfDay(selectedDate).getTime();
        const dayEnd = endOfDay(selectedDate).getTime();
        storage.getLogs(dayStart, dayEnd).then(setDayLogs);
    };

    const handleAddEvent = async () => {
        if (!eventTitle.trim()) return;
        const [h, m] = eventTime.split(':').map(n => parseInt(n, 10));
        const startTime = set(selectedDate, { hours: h || 0, minutes: m || 0, seconds: 0, milliseconds: 0 }).getTime();
        const endTime = startTime + 60 * 60 * 1000;
        const newEvent: CalendarEvent = {
            id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
            title: eventTitle.trim(),
            startTime,
            endTime,
            description: eventDesc.trim()
        };
        await storage.saveEvent(newEvent);
        setEventTitle('');
        setEventDesc('');
        setEventTime('09:00');
        const start = startOfMonth(currentDate).getTime();
        const end = endOfMonth(currentDate).getTime();
        storage.getEvents().then(setEvents);
        storage.getLogs(start, end).then(setAllMonthLogs);
    };

    useEffect(() => {
        const handler = () => {
            const start = startOfMonth(currentDate).getTime();
            const end = endOfMonth(currentDate).getTime();
            storage.getLogs(start, end).then(setAllMonthLogs);

            const dayStart = startOfDay(selectedDate).getTime();
            const dayEnd = endOfDay(selectedDate).getTime();
            storage.getLogs(dayStart, dayEnd).then(setDayLogs);
            storage.getEvents().then(setEvents);
        };
        window.addEventListener('data-updated', handler);
        return () => window.removeEventListener('data-updated', handler);
    }, [currentDate, selectedDate]);

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header - Fixed */}
            <div className="flex-none px-4 pt-8 pb-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Data Archives</h1>
                    <div className="flex space-x-2">
                        <label className="p-2 bg-surface border border-white/10 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                            <Upload size={18} className="text-gray-400" />
                            <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
                        </label>
                        <button
                            onClick={handleExport}
                            className="p-2 bg-surface border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
                        >
                            <Download size={18} className="text-gray-400" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Calendar - Fixed */}
            <div className="flex-none px-4 pb-4">
                <div className="bg-surface rounded-2xl p-4 border border-white/5">
                    {/* Month Navigation */}
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1))}
                            className="p-1.5 hover:bg-white/10 rounded transition-colors"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <span className="font-bold text-lg">{format(currentDate, 'MMMM yyyy')}</span>
                        <button
                            onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1))}
                            className="p-1.5 hover:bg-white/10 rounded transition-colors"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {/* Day Headers */}
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                            <div key={`header-${i}`} className="text-center text-sm sm:text-xs text-gray-500 py-2 font-medium">
                                {d}
                            </div>
                        ))}

                        {/* Empty cells before month starts */}
                        {Array.from({ length: startOfMonth(currentDate).getDay() }).map((_, i) => (
                            <div key={`empty-${i}`} className="h-11 sm:h-9" />
                        ))}

                        {/* Day cells */}
                        {days.map(day => {
                            const isSelected = isSameDay(day, selectedDate);
                            const isToday = isSameDay(day, new Date());
                            const hasLog = hasData(day);
                            const hasEvt = hasEvent(day);

                            return (
                                <button
                                    key={day.toISOString()}
                                    onClick={() => setSelectedDate(day)}
                                    className={cn(
                                        "h-11 sm:h-9 rounded-lg flex flex-col items-center justify-center transition-all text-base sm:text-sm",
                                        isSelected
                                            ? "bg-blue-600 text-white font-medium"
                                            : "hover:bg-white/5",
                                        isToday && !isSelected && "ring-1 ring-blue-500/50"
                                    )}
                                >
                                    <span>{format(day, 'd')}</span>
                                    {(hasLog || hasEvt) && (
                                        <div
                                            className={cn(
                                                "w-1 h-1 rounded-full -mt-0.5",
                                                isSelected ? "bg-white" : hasEvt ? "bg-amber-400" : "bg-blue-500"
                                            )}
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Records List - Stack with page scroll */}
            <div className="px-4 pb-32 overflow-y-auto flex-1">
                <div className="flex flex-col">
                    {/* Date label */}
                    <div className="flex-none pb-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base sm:text-sm font-semibold text-gray-400">
                                {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                            </h3>
                            <button
                                onClick={() => setShowEvents(v => !v)}
                                className="text-sm sm:text-xs px-3 py-2 sm:px-2 sm:py-1 rounded-lg border border-white/10 text-gray-300 hover:border-white/30"
                            >
                                {showEvents ? "收起事件" : "事件"}
                            </button>
                        </div>
                    </div>

                    {/* Events inline editor (collapsible) */}
                    {showEvents && (
                        <div className="flex-none mb-3 space-y-2">
                            <div className="flex items-center justify-between text-sm sm:text-xs text-gray-500">
                                <span className="flex items-center gap-2 text-gray-300 font-semibold"><CalendarPlus size={14} /> 日程 / 事件</span>
                                <span className="text-[11px] text-gray-500">同步到 Chat 语境</span>
                            </div>
                            <div className="grid grid-cols-1 gap-2 text-sm sm:text-xs">
                                <input
                                    value={eventTitle}
                                    onChange={e => setEventTitle(e.target.value)}
                                    className="bg-background border border-white/10 rounded-lg p-3 sm:p-2 text-base sm:text-sm"
                                    placeholder="事件标题（如会议、运动）"
                                />
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="time"
                                        value={eventTime}
                                        onChange={e => setEventTime(e.target.value)}
                                        className="bg-background border border-white/10 rounded-lg p-3 sm:p-2 text-base sm:text-sm"
                                    />
                                    <input
                                        value={eventDesc}
                                        onChange={e => setEventDesc(e.target.value)}
                                        className="bg-background border border-white/10 rounded-lg p-3 sm:p-2 text-base sm:text-sm"
                                        placeholder="备注 / 影响"
                                    />
                                </div>
                                <button
                                    onClick={handleAddEvent}
                                    className="w-full py-3 sm:py-2 rounded-lg bg-white text-black font-semibold text-base sm:text-sm hover:bg-gray-100 transition-colors"
                                >
                                    保存事件
                                </button>
                            </div>
                            <div className="space-y-1">
                                {dayEvents.length === 0 && (
                                    <div className="text-sm sm:text-xs text-gray-600">这一天暂无事件，添加后会出现在记录展开处。</div>
                                )}
                                {dayEvents.map(evt => (
                                    <div key={evt.id} className="bg-white/5 border border-white/10 rounded-lg p-3 sm:p-2 text-sm sm:text-xs text-gray-200">
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold">{evt.title}</span>
                                            <span className="text-gray-500">{format(evt.startTime, 'HH:mm')}</span>
                                        </div>
                                        {evt.description && <div className="text-[11px] text-gray-400 mt-1">{evt.description}</div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Records stack */}
                    <div className="space-y-3">
                        {dayLogs.length === 0 ? (
                            <div className="text-center py-12 text-gray-500 text-sm">
                                今天还没有记录
                            </div>
                        ) : (
                            dayLogs.map((log) => (
                                <RecordItem
                                    key={log.id}
                                    log={log}
                                    onDelete={() => handleDeleteLog(log.id)}
                                    dayEvents={dayEvents}
                                />
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Separate component for each record item
const RecordItem: React.FC<{ log: LogEntry; onDelete: () => void; dayEvents: CalendarEvent[] }> = ({ log, onDelete, dayEvents }) => {
    const [expanded, setExpanded] = useState(false);
    const recordEvents = dayEvents.filter(evt => evt.logId === log.id);

    return (
        <div className="bg-surface border border-white/5 rounded-xl overflow-hidden">
            {/* Clickable header */}
            <div
                className="p-4 cursor-pointer hover:bg-white/5 transition-colors active:scale-[0.99]"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-start justify-between gap-4">
                    {/* Left: Time and Values */}
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-sm sm:text-xs text-gray-500 font-medium">
                                {format(log.timestamp, 'HH:mm')}
                            </span>
                            <ChevronDown
                                size={14}
                                className={cn(
                                    "text-gray-500 transition-transform duration-200",
                                    expanded && "rotate-180"
                                )}
                            />
                        </div>
                        <div className="flex gap-2 text-base sm:text-sm font-mono">
                            <span className="text-green-500">P:{log.values.p}</span>
                            <span className="text-blue-500">C:{log.values.c}</span>
                            <span className="text-red-500">S:{log.values.s}</span>
                        </div>
                    </div>

                    {/* Right: Tags and Delete */}
                    <div className="flex items-center gap-2">
                        {log.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 max-w-[120px] justify-end">
                                {log.tags.slice(0, 2).map(tag => (
                                    <span
                                        key={tag}
                                        className="text-xs sm:text-[10px] px-2 py-1 sm:px-1.5 sm:py-0.5 bg-white/5 rounded text-gray-400"
                                    >
                                        {tag}
                                    </span>
                                ))}
                                {log.tags.length > 2 && (
                                    <span className="text-[10px] text-gray-500">
                                        +{log.tags.length - 2}
                                    </span>
                                )}
                            </div>
                        )}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                            className="p-3 sm:p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="删除"
                        >
                            <Trash2 size={20} className="sm:w-4 sm:h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Expanded details */}
            {expanded && (
                <div className="px-4 pb-4 pt-0 border-t border-white/5">
                    <div className="pt-3 space-y-2">
                        {/* All tags */}
                        {log.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {log.tags.map(tag => (
                                    <span
                                        key={tag}
                                        className="text-sm sm:text-xs px-3 py-1.5 sm:px-2 sm:py-1 bg-white/5 rounded text-gray-300"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Note */}
                        {log.note && (
                            <p className="text-sm sm:text-xs text-gray-400 italic leading-relaxed">
                                "{log.note}"
                            </p>
                        )}

                        {/* Events for this record */}
                        {recordEvents.length > 0 && (
                            <div className="space-y-1">
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider">当天事件</div>
                                {recordEvents.map(evt => (
                                    <div key={evt.id} className="text-sm sm:text-xs text-gray-300 bg-white/5 rounded-md px-3 py-2 sm:px-2 sm:py-1 border border-white/10 flex items-center justify-between">
                                        <span className="font-semibold">{evt.title}</span>
                                        <span className="text-gray-500">{format(evt.startTime, 'HH:mm')}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Trend */}
                        <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] text-gray-600 uppercase tracking-wider">
                                趋势: {log.trend}
                            </span>
                            <span className="text-[10px] text-gray-600">
                                {format(log.timestamp, 'MMM d, yyyy HH:mm')}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
