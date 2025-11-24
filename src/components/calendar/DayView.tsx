import React from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import type { LogEntry, CalendarEvent } from '../../types';
import { cn } from '../../utils/cn';

interface DayViewProps {
    currentDate: Date;
    selectedDate: Date;
    allMonthLogs: LogEntry[];
    events: CalendarEvent[];
    expanded: boolean;
    onDateChange: (date: Date) => void;
    onDateSelect: (date: Date) => void;
    onToggleExpand: () => void;
}

export const DayView: React.FC<DayViewProps> = ({
    currentDate,
    selectedDate,
    allMonthLogs,
    events,
    expanded,
    onDateChange,
    onDateSelect,
    onToggleExpand
}) => {
    const days = eachDayOfInterval({
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate)
    });

    const hasData = (day: Date) => allMonthLogs.some(log => isSameDay(new Date(log.timestamp), day));
    const hasEvent = (day: Date) => events.some(evt => {
        const evtDate = new Date(evt.startTime);
        return isSameDay(evtDate, day);
    });

    const goToPrevMonth = () => {
        const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1);
        onDateChange(newDate);
    };

    const goToNextMonth = () => {
        const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1);
        onDateChange(newDate);
    };

    return (
        <div className="flex-none px-4 pb-2">
            <div className="bg-surface rounded-2xl p-3 border border-white/5">
                {/* Header with expand/collapse button */}
                <button
                    onClick={onToggleExpand}
                    className="w-full flex items-center justify-between mb-2"
                >
                    <span className="font-bold text-lg">{format(currentDate, 'MMMM yyyy')}</span>
                    <ChevronDown
                        size={20}
                        className={cn("transition-transform", expanded ? "" : "rotate-180")}
                    />
                </button>

                {expanded && (
                    <>
                        {/* Month Navigation */}
                        <div className="flex items-center justify-between mb-2">
                            <button
                                onClick={goToPrevMonth}
                                className="p-1.5 hover:bg-white/10 rounded transition-colors"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <span className="font-bold text-lg">{format(currentDate, 'MMMM yyyy')}</span>
                            <button
                                onClick={goToNextMonth}
                                className="p-1.5 hover:bg-white/10 rounded transition-colors"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 gap-0.5">
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
                                        onClick={() => onDateSelect(day)}
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
                    </>
                )}
            </div>
        </div>
    );
};
