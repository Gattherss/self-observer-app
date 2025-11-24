import React from 'react';
import { format } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import type { LogEntry } from '../../types';
import { cn } from '../../utils/cn';

interface MonthViewProps {
    currentDate: Date;
    allMonthLogs: LogEntry[];
    expanded: boolean;
    onToggleExpand: () => void;
    onDateSelect: (date: Date) => void;
}

export const MonthView: React.FC<MonthViewProps> = ({
    currentDate,
    allMonthLogs,
    expanded,
    onToggleExpand,
    onDateSelect
}) => {
    // Group logs by day
    const logsByDay = allMonthLogs.reduce((acc, log) => {
        const dayKey = format(new Date(log.timestamp), 'yyyy-MM-dd');
        if (!acc[dayKey]) acc[dayKey] = [];
        acc[dayKey].push(log);
        return acc;
    }, {} as Record<string, LogEntry[]>);

    const sortedDays = Object.keys(logsByDay).sort();

    return (
        <div className="flex-none px-4 pb-2">
            <div className="bg-surface rounded-2xl p-3 border border-white/5">
                <button
                    onClick={onToggleExpand}
                    className="w-full flex items-center justify-between mb-2"
                >
                    <span className="font-bold text-lg">月历 - {format(currentDate, 'MMMM yyyy')}</span>
                    <ChevronDown
                        size={20}
                        className={cn("transition-transform", expanded ? "" : "rotate-180")}
                    />
                </button>

                {expanded && (
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                        {sortedDays.length > 0 ? (
                            sortedDays.map(dayKey => {
                                const dayLogs = logsByDay[dayKey];
                                const date = new Date(dayKey);
                                return (
                                    <button
                                        key={dayKey}
                                        onClick={() => onDateSelect(date)}
                                        className="w-full bg-white/5 hover:bg-white/10 rounded-lg p-2 text-left transition-colors"
                                    >
                                        <div className="text-sm font-medium text-gray-300">
                                            {format(date, 'MM月dd日 EEEE')}
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1">
                                            {dayLogs.length} 条记录
                                        </div>
                                    </button>
                                );
                            })
                        ) : (
                            <div className="text-sm text-gray-600 text-center py-8">
                                本月无记录
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
