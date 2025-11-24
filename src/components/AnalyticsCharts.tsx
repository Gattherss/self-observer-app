import React from 'react';
import { Area, Line, ComposedChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import type { ChartDataPoint } from '../utils/analytics';
import type { TrinityValue } from '../types';

interface Props {
    data: ChartDataPoint[];
    onHover: (values: TrinityValue | null, delta: TrinityValue | null, time: string | null) => void;
    setActiveIndex: (index: number | null) => void;
}

export const AnalyticsCharts: React.FC<Props> = ({ data, onHover, setActiveIndex }) => {
    const handleMouseMove = (state: any) => {
        if (state.isTooltipActive && state.activePayload && state.activePayload.length > 0) {
            const item = state.activePayload[0].payload as ChartDataPoint;

            // Construct current values (use Actual if exists, else Baseline)
            const current: TrinityValue = {
                p: item.p_actual ?? item.p_baseline,
                c: item.c_actual ?? item.c_baseline,
                s: item.s_actual ?? item.s_baseline
            };

            // Calculate Delta (Actual - Baseline)
            const delta: TrinityValue = {
                p: (item.p_actual ?? item.p_baseline) - item.p_baseline,
                c: (item.c_actual ?? item.c_baseline) - item.c_baseline,
                s: (item.s_actual ?? item.s_baseline) - item.s_baseline
            };

            onHover(current, delta, item.time);
            setActiveIndex(state.activeTooltipIndex);
        } else {
            onHover(null, null, null);
            setActiveIndex(null);
        }
    };

    const commonChartProps = {
        data: data,
        margin: { top: 5, right: 0, left: -20, bottom: 0 },
        onMouseMove: handleMouseMove,
        onMouseLeave: () => {
            onHover(null, null, null);
            setActiveIndex(null);
        },
        syncId: "trinityId" // Syncs the tooltips/cursor across charts
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload as ChartDataPoint;
            return (
                <div className="bg-surface/90 backdrop-blur border border-white/10 p-3 rounded-lg shadow-xl text-xs z-50">
                    <div className="font-bold text-gray-300 mb-2">{label}</div>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span className="text-green-400">P: {data.p_actual?.toFixed(1) ?? '-'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            <span className="text-blue-400">C: {data.c_actual?.toFixed(1) ?? '-'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                            <span className="text-red-400">S: {data.s_actual?.toFixed(1) ?? '-'}</span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="flex flex-col h-full space-y-4">
            {/* P Chart */}
            <div className="flex-1 min-h-[120px] relative">
                <div className="absolute top-2 left-2 text-xs font-bold text-green-500 z-10">PHYSICAL</div>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart {...commonChartProps}>
                        <defs>
                            <linearGradient id="gradP" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="time" hide />
                        <YAxis domain={[0, 10]} hide />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1 }} />

                        <Area type="monotone" dataKey="p_standard" stroke="none" fill="url(#gradP)" />
                        <Line type="monotone" dataKey="p_baseline" stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.5} dot={false} strokeWidth={1} />
                        {/* Actual (Solid) */}
                        <Line type="monotone" dataKey="p_actual" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: '#22c55e' }} connectNulls />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* C Chart */}
            <div className="flex-1 min-h-[120px] relative">
                <div className="absolute top-2 left-2 text-xs font-bold text-blue-500 z-10">COGNITIVE</div>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart {...commonChartProps}>
                        <defs>
                            <linearGradient id="gradC" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="time" hide />
                        <YAxis domain={[0, 10]} hide />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1 }} />

                        <Area type="monotone" dataKey="c_standard" stroke="none" fill="url(#gradC)" />
                        <Line type="monotone" dataKey="c_baseline" stroke="#3b82f6" strokeDasharray="3 3" strokeOpacity={0.5} dot={false} strokeWidth={1} />
                        <Line type="monotone" dataKey="c_actual" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} connectNulls />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* S Chart */}
            <div className="flex-1 min-h-[120px] relative">
                <div className="absolute top-2 left-2 text-xs font-bold text-red-500 z-10">IMPULSE</div>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart {...commonChartProps}>
                        <defs>
                            <linearGradient id="gradS" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="time" tick={{ fill: '#525252', fontSize: 10 }} interval={4} />
                        <YAxis domain={[0, 10]} hide />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1 }} />

                        <Area type="monotone" dataKey="s_standard" stroke="none" fill="url(#gradS)" />
                        <Line type="monotone" dataKey="s_baseline" stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} dot={false} strokeWidth={1} />
                        <Line type="monotone" dataKey="s_actual" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} connectNulls />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
