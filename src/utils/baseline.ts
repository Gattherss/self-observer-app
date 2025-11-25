import type { LogEntry, TrinityValue } from '../types';

export const DEFAULT_BASELINE: TrinityValue = { p: 5, c: 5, s: 2 };

const median = (values: number[]): number => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const filterOutliers = (values: number[]): number[] => {
    if (values.length < 4) return values;
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = median(sorted.slice(0, Math.floor(sorted.length / 2)));
    const q3 = median(sorted.slice(Math.ceil(sorted.length / 2)));
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    return sorted.filter(v => v >= lower && v <= upper);
};

export const computeMedianStats = (logs: LogEntry[]): { values: TrinityValue; sample: number; lowConfidence: boolean } => {
    if (logs.length === 0) return { values: DEFAULT_BASELINE, sample: 0, lowConfidence: true };
    const getVals = (key: keyof TrinityValue) => filterOutliers(logs.map(l => l.values[key]).filter(v => typeof v === 'number'));
    const pList = getVals('p');
    const cList = getVals('c');
    const sList = getVals('s');
    const sample = Math.min(pList.length, cList.length, sList.length);
    return {
        values: {
            p: pList.length ? median(pList) : DEFAULT_BASELINE.p,
            c: cList.length ? median(cList) : DEFAULT_BASELINE.c,
            s: sList.length ? median(sList) : DEFAULT_BASELINE.s,
        },
        sample,
        lowConfidence: sample < 5,
    };
};

export const getMonthKey = (date: Date) => {
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, '0');
    return `${y}-${m}`;
};
