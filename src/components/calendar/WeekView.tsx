import React from 'react';
import { format, startOfWeek, endOfWeek, eachWeekOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import type { LogEntry } from '../../types';
import { cn } from '../../utils/cn';

interface WeekViewProps {
    currentDate: Date;
    allMonthLogs: LogEntry[];
    expanded: boolean;
    onToggleExpand: () => void;
    onDateSelect: (date: Date) => void;
}

export const WeekView: React.FC<WeekViewProps> = ({
    currentDate,
    allMonthLogs,
    expanded,
    onToggleExpand,
    onDateSelect
}) => {
    // Get all weeks in the current month
    const weeks = eachWeekOfInterval({
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate)
    }, { weekStartsOn: 0 }); // Sunday

    // Get logs for each week
    const getWeekLogs = (weekStart: Date) => {
        const start = startOfWeek(weekStart, { weekStartsOn: 0 }).getTime();
        const end = endOfWeek(weekStart, { weekStartsOn: 0 }).getTime();
        return allMonthLogs
            .filter(log => log.timestamp >= start && log.timestamp < end)
            .sort((a, b) => a.timestamp - b.timestamp);
    };

    return (
        <div className="flex-none px-4 pb-2">
            <div className="bg-surface rounded-2xl p-3 border border-white/5">
                <button
                    onClick={onToggleExpand}
                    className="w-full flex items-center justify-between mb-2"
                >
                    <span className="font-bold text-lg">周历 - {format(currentDate, 'MMMM yyyy')}</span>
                    <ChevronDown
                        size={20}
                        className={cn("transition-transform", expanded ? "" : "rotate-180")}
                    />
                </button>

                {expanded && (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {weeks.map((weekStart, index) => {
                            const weekLogs = getWeekLogs(weekStart);
                            const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });

                            return (
                                <button
                                    key={weekStart.toISOString()}
                                    onClick={() => onDateSelect(weekStart)}
                                    className="w-full bg-white/5 hover:bg-white/10 rounded-lg p-3 text-left transition-colors"
                                >
                                    <div className="text-sm font-semibold text-gray-300 mb-2">
                                        第{index + 1}周：{format(weekStart, 'MM/dd')} - {format(weekEnd, 'MM/dd')}
                                    </div>
                                    {weekLogs.length > 0 ? (
                                        <div className="text-xs text-gray-400">
                                            {weekLogs.length} 条记录
                                        </div>
                                    ) : (
                                        <div className="text-xs text-gray-600">无记录</div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
