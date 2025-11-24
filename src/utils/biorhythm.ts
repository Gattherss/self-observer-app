import type { LogEntry, TrinityValue } from '../types';
import { subDays } from 'date-fns';

// Weighted Moving Average
export const calculateWMA = (values: number[], weights: number[]): number => {
    if (values.length !== weights.length) return 0;
    const sum = values.reduce((acc, val, idx) => acc + val * weights[idx], 0);
    const weightSum = weights.reduce((acc, val) => acc + val, 0);
    return sum / weightSum;
};

// Simple smoothing for visualization
export const smoothData = (data: number[], windowSize: number = 3): number[] => {
    return data.map((_, idx) => {
        const start = Math.max(0, idx - Math.floor(windowSize / 2));
        const end = Math.min(data.length, idx + Math.ceil(windowSize / 2));
        const window = data.slice(start, end);
        return window.reduce((a, b) => a + b, 0) / window.length;
    });
};

interface DailyPattern {
    hour: number; // 0-24
    value: number;
}

// Reverse-engineer baseline from history
export const calculateDynamicBaseline = (historyLogs: LogEntry[], type: keyof TrinityValue): DailyPattern[] => {
    // 1. Group logs by hour of day (0-23)
    const hourlyGroups: { [key: number]: number[] } = {};
    for (let i = 0; i < 24; i++) hourlyGroups[i] = [];

    historyLogs.forEach(log => {
        const date = new Date(log.timestamp);
        const hour = date.getHours();
        hourlyGroups[hour].push(log.values[type]);
    });

    // 2. Calculate average for each hour
    // If no data for an hour, interpolate from neighbors (simple linear interpolation for now)
    const rawBaseline: number[] = [];
    for (let i = 0; i < 24; i++) {
        const values = hourlyGroups[i];
        if (values.length > 0) {
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            rawBaseline.push(avg);
        } else {
            rawBaseline.push(-1); // Mark as missing
        }
    }

    // 3. Fill missing values (Interpolation)
    let filledBaseline = [...rawBaseline];
    // Forward fill / Linear Interp
    for (let i = 0; i < 24; i++) {
        if (filledBaseline[i] === -1) {
            // Find previous valid
            let prev = i - 1;
            while (prev >= 0 && filledBaseline[prev] === -1) prev--;
            const prevVal = prev >= 0 ? filledBaseline[prev] : 5; // Default 5 if start missing

            // Find next valid
            let next = i + 1;
            while (next < 24 && filledBaseline[next] === -1) next++;
            const nextVal = next < 24 ? filledBaseline[next] : prevVal;

            filledBaseline[i] = (prevVal + nextVal) / 2;
        }
    }

    // 4. Apply Smoothing (WMA) to create a natural curve
    // Wrap around for continuity (23h -> 0h)
    const extended = [...filledBaseline.slice(-3), ...filledBaseline, ...filledBaseline.slice(0, 3)];
    const smoothed = smoothData(extended, 3);
    // Extract the middle 24
    const finalBaseline = smoothed.slice(3, 27);

    return finalBaseline.map((val, idx) => ({ hour: idx, value: val }));
};

// Analyze Weekly Trend (Burnout/Manic detection)
export const analyzeWeeklyTrend = (logs: LogEntry[]) => {
    const now = Date.now();
    const oneWeekAgo = subDays(now, 7).getTime();
    const weeklyLogs = logs.filter(l => l.timestamp >= oneWeekAgo);

    if (weeklyLogs.length === 0) return { status: 'Normal', average: 5 };

    const avgP = weeklyLogs.reduce((acc, l) => acc + l.values.p, 0) / weeklyLogs.length;

    let status = 'Normal';
    if (avgP < 3) status = 'Burnout Risk';
    if (avgP > 8) status = 'Manic Risk';

    return { status, average: avgP };
};
