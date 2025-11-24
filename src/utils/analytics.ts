import type { LogEntry } from '../types';
import { startOfDay, format } from 'date-fns';

export interface ChartDataPoint {
    time: string; // HH:mm
    timestamp: number;

    // P (Physical)
    p_standard: number;
    p_baseline: number;
    p_actual: number | null;

    // C (Cognitive)
    c_standard: number;
    c_baseline: number;
    c_actual: number | null;

    // S (Sexual/Impulse)
    s_standard: number;
    s_baseline: number;
    s_actual: number | null;
}

// Generate 24h time slots (every 30 mins)
export const generateTimeSlots = (): number[] => {
    const slots: number[] = [];
    const start = startOfDay(new Date()).getTime();
    for (let i = 0; i < 48; i++) {
        slots.push(start + i * 30 * 60 * 1000);
    }
    return slots;
};

// Mock Standard Circadian Rhythm (0-10)
const getStandardValue = (hour: number, type: 'p' | 'c' | 's'): number => {
    if (type === 'p') {
        // Physical: Low at night, peaks at 10am and 6pm
        if (hour < 6) return 2;
        if (hour < 12) return 2 + (hour - 6) * 1.3; // Rise to ~9.8
        if (hour < 15) return 8; // Dip
        if (hour < 18) return 9; // Peak
        return 9 - (hour - 18) * 1.2; // Drop
    }
    if (type === 'c') {
        // Cognitive: High morning, dip afternoon, high late night?
        if (hour < 5) return 1;
        if (hour < 11) return 9;
        if (hour < 14) return 5; // Post-lunch dip
        if (hour < 17) return 8;
        return 4;
    }
    if (type === 's') {
        // Impulse: High at night/morning
        if (hour < 8) return 7;
        if (hour < 20) return 3;
        return 8;
    }
    return 5;
};

import { calculateDynamicBaseline } from './biorhythm';

export const processChartData = (todayLogs: LogEntry[], historyLogs: LogEntry[] = []): ChartDataPoint[] => {
    const slots = generateTimeSlots();

    // Calculate Dynamic Baselines from History
    // If no history, fallback to Standard (or empty)
    const p_baseline_curve = historyLogs.length > 0 ? calculateDynamicBaseline(historyLogs, 'p') : [];
    const c_baseline_curve = historyLogs.length > 0 ? calculateDynamicBaseline(historyLogs, 'c') : [];
    const s_baseline_curve = historyLogs.length > 0 ? calculateDynamicBaseline(historyLogs, 's') : [];

    return slots.map(slotTime => {
        const date = new Date(slotTime);
        const hour = date.getHours();
        const minute = date.getMinutes();
        const hourFloat = hour + minute / 60;
        const timeStr = format(date, 'HH:mm');

        // 1. Standard
        const p_standard = getStandardValue(hourFloat, 'p');
        const c_standard = getStandardValue(hourFloat, 'c');
        const s_standard = getStandardValue(hourFloat, 's');

        // 2. Actual (Find log nearest to this slot within 30 mins)
        const log = todayLogs.find(l => Math.abs(l.timestamp - slotTime) < 15 * 60 * 1000);

        // 3. Baseline (Get from calculated curve)
        // Curve is 0-23 integers. Interpolate or just grab nearest hour?
        // Our curve is smoothed, so nearest hour is okay for now, or simple linear interp.
        const getBaselineVal = (curve: { hour: number, value: number }[], h: number, std: number) => {
            if (curve.length === 0) return std; // Fallback to standard if no history
            const item = curve.find(i => i.hour === h);
            return item ? item.value : std;
        };

        const p_baseline = getBaselineVal(p_baseline_curve, hour, p_standard);
        const c_baseline = getBaselineVal(c_baseline_curve, hour, c_standard);
        const s_baseline = getBaselineVal(s_baseline_curve, hour, s_standard);

        return {
            time: timeStr,
            timestamp: slotTime,
            p_standard,
            p_baseline,
            p_actual: log ? log.values.p : null,
            c_standard,
            c_baseline,
            c_actual: log ? log.values.c : null,
            s_standard,
            s_baseline,
            s_actual: log ? log.values.s : null,
        };
    });
};
