import type { LogEntry, TrendDirection } from '../types';
import { format } from 'date-fns';

export const exportLogsToCSV = (logs: LogEntry[]) => {
    const headers = ['ID', 'Timestamp', 'Date', 'Time', 'P', 'C', 'S', 'Tags', 'Trend', 'Note'];
    const rows = logs.map(log => [
        log.id,
        log.timestamp,
        format(log.timestamp, 'yyyy-MM-dd'),
        format(log.timestamp, 'HH:mm:ss'),
        log.values.p,
        log.values.c,
        log.values.s,
        `"${log.tags.join(',')}"`,
        log.trend,
        `"${log.note || ''}"`
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `neurotracker_export_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const parseCSV = (csvText: string): Partial<LogEntry>[] => {
    const lines = csvText.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',');

    // Basic validation
    if (!headers.includes('Timestamp') || !headers.includes('P')) {
        throw new Error('Invalid CSV format');
    }

    const parseLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuote = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuote = !inQuote;
            } else if (char === ',' && !inQuote) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        return result;
    };

    return lines.slice(1).map(line => {
        const cols = parseLine(line);

        // Ensure we have enough columns
        if (cols.length < 7) return {};

        // Helper to safely parse float
        const safeFloat = (val: string) => {
            const parsed = parseFloat(val);
            return isNaN(parsed) ? 0 : parsed;
        };

        // Helper to clean quotes
        const clean = (val: string) => val ? val.replace(/^"|"$/g, '').replace(/""/g, '"').trim() : '';

        let timestamp = parseInt(cols[1]);
        if (isNaN(timestamp)) return {};

        // Handle timestamps provided in seconds (10 digits) by converting to ms
        if (timestamp < 1e12) {
            timestamp *= 1000;
        }

        return {
            timestamp,
            values: {
                p: safeFloat(cols[4]),
                c: safeFloat(cols[5]),
                s: safeFloat(cols[6])
            },
            tags: clean(cols[7]).split(',').filter(t => t),
            trend: clean(cols[8]) as TrendDirection,
            note: clean(cols[9])
        };
    }).filter(entry => entry.timestamp !== undefined && entry.values !== undefined);
};
