import type { LogEntry } from '../types';

// 周历/月历数据 - 不计算汇总，只是按时间排序的记录列表
export interface PeriodData {
    period: string; // e.g., "2025年11月 第4周" or "2025年11月"
    startDate: number;
    endDate: number;
    logs: LogEntry[]; // 该时间段的所有记录，按时间排序
}

// 获取周数据 - 返回该周所有记录
export const getWeekData = (allLogs: LogEntry[], weekStart: number, weekEnd: number): PeriodData => {
    const weekLogs = allLogs
        .filter(l => l.timestamp >= weekStart && l.timestamp < weekEnd)
        .sort((a, b) => a.timestamp - b.timestamp); // 按时间正序排列

    const weekNum = Math.ceil(new Date(weekStart).getDate() / 7);
    const monthName = new Date(weekStart).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });

    return {
        period: `${monthName} 第${weekNum}周`,
        startDate: weekStart,
        endDate: weekEnd,
        logs: weekLogs
    };
};

// 获取月数据 - 返回该月所有记录
export const getMonthData = (allLogs: LogEntry[], monthStart: number, monthEnd: number): PeriodData => {
    const monthLogs = allLogs
        .filter(l => l.timestamp >= monthStart && l.timestamp < monthEnd)
        .sort((a, b) => a.timestamp - b.timestamp); // 按时间正序排列

    const monthName = new Date(monthStart).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });

    return {
        period: monthName,
        startDate: monthStart,
        endDate: monthEnd,
        logs: monthLogs
    };
};
