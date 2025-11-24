import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Brush } from 'recharts';
import { format } from 'date-fns';
import type { LogEntry } from '../types';

interface Props {
    logs: LogEntry[];
}

export const LandscapeChart: React.FC<Props> = ({ logs }) => {
    const data = React.useMemo(() => {
        return logs.map(log => ({
            timestamp: log.timestamp,
            date: format(new Date(log.timestamp), 'MM/dd HH:mm'),
            p: log.values.p,
            c: log.values.c,
            s: log.values.s,
        })).sort((a, b) => a.timestamp - b.timestamp);
    }, [logs]);

    if (data.length === 0) return null;

    return (
        <div className="w-full h-64 bg-surface/50 rounded-xl p-2 border border-white/5 mt-4">
            <div className="text-xs font-bold text-gray-500 mb-2 px-2">LANDSCAPE VIEW</div>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="gradP_L" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradC_L" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradS_L" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <XAxis
                        dataKey="date"
                        tick={{ fill: '#525252', fontSize: 10 }}
                        minTickGap={30}
                    />
                    <YAxis domain={[0, 10]} hide />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#121212', border: '1px solid #333' }}
                        itemStyle={{ fontSize: '12px' }}
                        labelStyle={{ color: '#888', marginBottom: '5px' }}
                    />
                    <Area type="monotone" dataKey="p" stackId="1" stroke="#22c55e" fill="url(#gradP_L)" />
                    <Area type="monotone" dataKey="c" stackId="1" stroke="#3b82f6" fill="url(#gradC_L)" />
                    <Area type="monotone" dataKey="s" stackId="1" stroke="#ef4444" fill="url(#gradS_L)" />
                    <Brush
                        dataKey="date"
                        height={20}
                        stroke="#525252"
                        fill="#1a1a1a"
                        tickFormatter={() => ''}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};
