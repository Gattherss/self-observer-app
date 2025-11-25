import React, { useEffect, useMemo, useState } from 'react';
import { Info, X } from 'lucide-react';
import { startOfDay, endOfDay } from 'date-fns';
import { useStore } from '../../store';
import { AnalyticsCharts } from '../AnalyticsCharts';
import { LandscapeChart } from '../LandscapeChart';
import { RadarDisplay } from '../RadarDisplay';
import { processChartData, type ChartDataPoint } from '../../utils/analytics';
import type { LogEntry, TrinityValue } from '../../types';
import { storage } from '../../services/storage';
import { UI_TEXT } from '../../utils/constants';
import { cn } from '../../utils/cn';

type DayType = 'all' | 'weekday' | 'weekend';
type HeatmapRange = 1 | 7 | 30;

const seasonOfMonth = (m: number) => {
    if (m === 11 || m === 0 || m === 1) return 'winter';
    if (m >= 2 && m <= 4) return 'spring';
    if (m >= 5 && m <= 7) return 'summer';
    return 'autumn';
};

const buildMatrix = (
    logs: LogEntry[],
    accessor: (log: LogEntry) => number,
    days: HeatmapRange,
    tag: string | 'all'
) => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
    const counts = Array.from({ length: 7 }, () => Array(24).fill(0));

    logs.forEach(log => {
        if (log.timestamp < cutoff) return;
        if (tag !== 'all' && !(log.tags || []).includes(tag)) return;
        const d = new Date(log.timestamp);
        const day = d.getDay(); // 0-6
        const hour = d.getHours();
        matrix[day][hour] += accessor(log);
        counts[day][hour] += 1;
    });

    return matrix.map((col, day) =>
        col.map((val, hour) => {
            const count = counts[day][hour];
            return count ? val / count : 0;
        })
    );
};

const colorScale = (val: number, base: [number, number, number]) => {
    const intensity = Math.min(1, val / 10);
    const alpha = 0.1 + intensity * 0.65;
    return `rgba(${base[0]}, ${base[1]}, ${base[2]}, ${alpha})`;
};

export const AnalyticsTab: React.FC = () => {
    const { recentLogs } = useStore();

    // Core chart states
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [hoverValues, setHoverValues] = useState<TrinityValue | null>(null);
    const [hoverDelta, setHoverDelta] = useState<TrinityValue | null>(null);
    const [hoverTime, setHoverTime] = useState<string | null>(null);

    // Baseline config
    const [baselineDays, setBaselineDays] = useState<7 | 30>(30);
    const [dayType, setDayType] = useState<DayType>('all');
    const [availableTags, setAvailableTags] = useState<string[]>([]);
    const [selectedTag, setSelectedTag] = useState<string>('all');
    const [baselineSample, setBaselineSample] = useState<number>(0);

    // History
    const [allHistoryLogs, setAllHistoryLogs] = useState<LogEntry[]>([]);
    const [heatRange, setHeatRange] = useState<HeatmapRange>(7);

    // Help modal
    const [showHelp, setShowHelp] = useState(false);

    // Load analytics data
    useEffect(() => {
        const loadData = async () => {
            const start = startOfDay(new Date()).getTime();
            const end = endOfDay(new Date()).getTime();
            const todayLogsRaw = await storage.getLogs(start, end);

            // Baseline window
            const historyStart = start - baselineDays * 24 * 60 * 60 * 1000;
            let historyLogs = await storage.getLogs(historyStart, start);

            if (dayType !== 'all') {
                const isWeekend = (ts: number) => {
                    const d = new Date(ts).getDay();
                    return d === 0 || d === 6;
                };
                historyLogs = historyLogs.filter(log => dayType === 'weekend' ? isWeekend(log.timestamp) : !isWeekend(log.timestamp));
            }

            const filterByTag = (logs: LogEntry[]) => {
                if (selectedTag === 'all') return logs;
                return logs.filter(l => (l.tags || []).includes(selectedTag));
            };

            const todayLogs = filterByTag(todayLogsRaw);
            const baselineLogs = filterByTag(historyLogs);
            setBaselineSample(baselineLogs.length);

            const processed = processChartData(todayLogs, baselineLogs);
            setChartData(processed);

            const allLogs = await storage.getLogs(0, end);
            setAllHistoryLogs(allLogs);

            const tagSet = new Set<string>();
            allLogs.forEach(l => (l.tags || []).forEach(t => t && tagSet.add(t)));
            setAvailableTags(Array.from(tagSet));
        };
        loadData();
    }, [recentLogs, baselineDays, dayType, selectedTag]);

    // Display values
    const displayValues = useMemo(() => {
        if (hoverValues) return hoverValues;
        if (recentLogs.length > 0) return recentLogs[recentLogs.length - 1].values;
        return { p: 5, c: 5, s: 5 };
    }, [hoverValues, recentLogs]);

    const formatDelta = (val: number) => {
        const sign = val > 0 ? '+' : '';
        return `${sign}${val.toFixed(1)}`;
    };

    const latestPoint = useMemo(() => {
        return [...chartData].reverse().find(p => p.p_actual !== null || p.c_actual !== null || p.s_actual !== null);
    }, [chartData]);

    const latestDelta = useMemo(() => {
        if (!latestPoint) return null;
        return {
            p: (latestPoint.p_actual ?? latestPoint.p_baseline) - latestPoint.p_baseline,
            c: (latestPoint.c_actual ?? latestPoint.c_baseline) - latestPoint.c_baseline,
            s: (latestPoint.s_actual ?? latestPoint.s_baseline) - latestPoint.s_baseline
        };
    }, [latestPoint]);

    const baselineConfidence = useMemo(() => {
        const expected = baselineDays; // assume at least one log per day
        const ratio = Math.min(1, baselineSample / Math.max(1, expected));
        return Math.round(ratio * 100);
    }, [baselineSample, baselineDays]);

    const insight = useMemo(() => {
        if (!latestDelta) return '暂无偏差，继续保持当前节奏。';
        const entries: Array<{ key: 'p' | 'c' | 's'; value: number }> = [
            { key: 'p', value: latestDelta.p },
            { key: 'c', value: latestDelta.c },
            { key: 's', value: latestDelta.s },
        ];
        const strongest = entries.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0];
        const labelMap = { p: '生理', c: '认知', s: '冲动' } as const;
        if (Math.abs(strongest.value) < 0.2) return '整体与基准接近，稳定状态。';
        const direction = strongest.value > 0 ? '高于基准' : '低于基准';
        return `${labelMap[strongest.key]}维度${direction}${formatDelta(strongest.value)}，留意触发场景。`;
    }, [latestDelta]);

    // Heatmap matrices
    const matrixP = useMemo(() => buildMatrix(allHistoryLogs, l => l.values.p, heatRange, selectedTag), [allHistoryLogs, heatRange, selectedTag]);
    const matrixC = useMemo(() => buildMatrix(allHistoryLogs, l => l.values.c, heatRange, selectedTag), [allHistoryLogs, heatRange, selectedTag]);
    const matrixS = useMemo(() => buildMatrix(allHistoryLogs, l => l.values.s, heatRange, selectedTag), [allHistoryLogs, heatRange, selectedTag]);
    const weekLabels = ['日', '一', '二', '三', '四', '五', '六'];

    // Seasonal stats per dimension
    const seasonStats = useMemo(() => {
        const map: Record<string, { p: number[]; c: number[]; s: number[] }> = {
            spring: { p: [], c: [], s: [] },
            summer: { p: [], c: [], s: [] },
            autumn: { p: [], c: [], s: [] },
            winter: { p: [], c: [], s: [] },
        };
        allHistoryLogs.forEach(log => {
            const season = seasonOfMonth(new Date(log.timestamp).getMonth());
            map[season].p.push(log.values.p);
            map[season].c.push(log.values.c);
            map[season].s.push(log.values.s);
        });
        const toAvg = (list: number[]) => list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0;
        return {
            spring: { p: toAvg(map.spring.p), c: toAvg(map.spring.c), s: toAvg(map.spring.s) },
            summer: { p: toAvg(map.summer.p), c: toAvg(map.summer.c), s: toAvg(map.summer.s) },
            autumn: { p: toAvg(map.autumn.p), c: toAvg(map.autumn.c), s: toAvg(map.autumn.s) },
            winter: { p: toAvg(map.winter.p), c: toAvg(map.winter.c), s: toAvg(map.winter.s) },
        };
    }, [allHistoryLogs]);

    const renderMatrix = (matrix: number[][], palette: [number, number, number], label: string, hint: string) => (
        <div className="bg-surface border border-white/10 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-sm font-semibold text-gray-200">{label}</div>
                    <div className="text-xs text-gray-500">{hint}</div>
                </div>
            </div>
            <div className="grid grid-cols-8 gap-1 text-[10px] text-gray-400">
                <div className="h-6" />
                {weekLabels.map(d => (
                    <div key={d} className="text-center h-6 flex items-center justify-center">{d}</div>
                ))}
                {Array.from({ length: 24 }).map((_, hour) => (
                    <React.Fragment key={hour}>
                        <div className="h-6 flex items-center text-right pr-1">{hour.toString().padStart(2, '0')}</div>
                        {matrix.map((col, day) => (
                            <div
                                key={`${day}-${hour}`}
                                className="h-6 rounded-md border border-white/5 flex items-center justify-center font-mono"
                                style={{ backgroundColor: colorScale(col[hour], palette) }}
                                title={`${weekLabels[day]} ${hour}:00 -> ${col[hour] ? col[hour].toFixed(1) : '-'}`}
                            >
                                <span className="text-[10px] text-gray-100">{col[hour] ? col[hour].toFixed(1) : '-'}</span>
                            </div>
                        ))}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col pt-8 pb-24 px-4 overflow-hidden relative">
            {/* Top Section */}
            <div className="flex items-center justify-between mb-6 h-40">
                <div className="flex-1 flex justify-center relative">
                    <RadarDisplay values={displayValues} size={140} showLabels={false} />
                    <button
                        onClick={() => setShowHelp(true)}
                        className="absolute top-0 right-0 p-2 text-gray-500 hover:text-white transition-colors"
                    >
                        <Info size={16} />
                    </button>
                </div>
                <div className="w-32 flex flex-col justify-center space-y-2">
                    <div className="text-xs text-gray-500 uppercase tracking-widest mb-1 flex justify-between items-center">
                        <span>{hoverTime || 'Delta'}</span>
                    </div>
                    {hoverDelta ? (
                        <>
                            <div className="flex justify-between text-xs">
                                <span className="text-green-500 font-bold">P</span>
                                <span className="text-white">{formatDelta(hoverDelta.p)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-blue-500 font-bold">C</span>
                                <span className="text-white">{formatDelta(hoverDelta.c)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-red-500 font-bold">S</span>
                                <span className="text-white">{formatDelta(hoverDelta.s)}</span>
                            </div>
                        </>
                    ) : (
                        <div className="text-xs text-gray-600 italic">
                            {UI_TEXT.analytics.noData}
                        </div>
                    )}
                </div>
            </div>

            {/* Baseline vs Actual + Filters */}
            <div className="grid grid-cols-1 gap-3 mb-4">
                <div className="bg-surface border border-white/10 rounded-2xl p-4 shadow-xl">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold text-gray-300">基准 vs 实际</div>
                        <span className="text-[10px] text-gray-500 uppercase">Now</span>
                    </div>
                    {latestPoint ? (
                        <div className="space-y-2">
                            <div className="grid grid-cols-3 gap-2 text-xs">
                                {(['p', 'c', 's'] as const).map(key => {
                                    const baselineVal = latestPoint?.[`${key}_baseline` as keyof ChartDataPoint] as number;
                                    const actualVal = ((latestPoint?.[`${key}_actual` as keyof ChartDataPoint]) ?? baselineVal) as number;
                                    const deltaVal = latestDelta?.[key] || 0;
                                    const color = key === 'p' ? 'text-green-400' : key === 'c' ? 'text-blue-400' : 'text-red-400';
                                    return (
                                        <div key={key} className="bg-white/5 rounded-lg p-2 border border-white/5">
                                            <div className="flex items-center justify-between text-gray-400">
                                                <span className="uppercase font-bold">{key}</span>
                                                <span className="text-[10px] text-gray-500">基准 {baselineVal.toFixed(1)}</span>
                                            </div>
                                            <div className="flex items-center justify-between mt-1">
                                                <span className={cn("text-sm font-semibold", color)}>{actualVal.toFixed(1)}</span>
                                                <span
                                                    className={cn(
                                                        "text-[11px] font-mono",
                                                        deltaVal > 0 ? "text-blue-400" : deltaVal < 0 ? "text-red-400" : "text-gray-500"
                                                    )}
                                                >
                                                    {formatDelta(deltaVal)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">{insight}</div>
                        </div>
                    ) : (
                        <div className="text-xs text-gray-500">今天还没有记录，快去“记录”页按下记录状态。</div>
                    )}
                </div>

                <div className="bg-surface border border-white/10 rounded-2xl p-4 shadow-xl space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-gray-300">基准透明度</div>
                        <div className="text-[11px] text-gray-500">可信度 {baselineConfidence}%</div>
                    </div>
                    <div className="text-[11px] text-gray-500">
                        基准来源：最近 {baselineDays} 天 {dayType === 'all' ? '（全部样本）' : dayType === 'weekday' ? '仅工作日' : '仅周末'} · 样本 {baselineSample} 条
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                        <div className="flex bg-white/5 rounded-lg overflow-hidden border border-white/10">
                            {[7, 30].map((d) => (
                                <button
                                    key={d}
                                    onClick={() => setBaselineDays(d as 7 | 30)}
                                    className={cn(
                                        "px-3 py-1 border-r border-white/10 last:border-r-0",
                                        baselineDays === d ? "bg-white text-black font-semibold" : "text-gray-400"
                                    )}
                                >
                                    {d}天
                                </button>
                            ))}
                        </div>
                        <div className="flex bg-white/5 rounded-lg overflow-hidden border border-white/10">
                            {[
                                { id: 'all', label: '全部' },
                                { id: 'weekday', label: '工作日' },
                                { id: 'weekend', label: '周末' },
                            ].map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => setDayType(opt.id as DayType)}
                                    className={cn(
                                        "px-3 py-1 border-r border-white/10 last:border-r-0",
                                        dayType === opt.id ? "bg-primary/20 text-white font-semibold" : "text-gray-400"
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-gray-500">标签筛选：</span>
                            <button
                                onClick={() => setSelectedTag('all')}
                                className={cn(
                                    "px-3 py-1 rounded-full text-xs border transition-all",
                                    selectedTag === 'all' ? "bg-primary text-black border-primary" : "border-white/10 text-gray-400 hover:border-white/30"
                                )}
                            >
                                全部
                            </button>
                            {availableTags.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => setSelectedTag(tag)}
                                    className={cn(
                                        "px-3 py-1 rounded-full text-xs border transition-all",
                                        selectedTag === tag ? "bg-primary text-black border-primary" : "border-white/10 text-gray-300 hover:border-white/30"
                                    )}
                                >
                                    {tag}
                                </button>
                            ))}
                            {availableTags.length === 0 && (
                                <span className="text-xs text-gray-600">暂无标签样本</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts + Heatmap + Seasonal */}
            <div className="flex-1 w-full min-h-0 overflow-y-auto pb-20 space-y-4">
                <div className="h-[400px]">
                    <AnalyticsCharts
                        data={chartData}
                        onHover={(vals, delta, time) => {
                            setHoverValues(vals);
                            setHoverDelta(delta);
                            setHoverTime(time || null);
                        }}
                        setActiveIndex={() => {}}
                    />
                </div>

                {/* Heatmap 2D with tag overlay */}
                <div className="bg-surface border border-white/10 rounded-2xl p-4 shadow-xl space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-semibold text-gray-200">情绪地图</div>
                            <div className="text-xs text-gray-500">按“小时 x 星期”叠加标签热度</div>
                        </div>
                        <div className="flex bg-white/5 rounded-lg overflow-hidden border border-white/10 text-xs">
                            {[1, 7, 30].map(r => (
                                <button
                                    key={r}
                                    onClick={() => setHeatRange(r as HeatmapRange)}
                                    className={cn(
                                        "px-3 py-1 border-r border-white/10 last:border-r-0",
                                        heatRange === r ? "bg-primary/20 text-white font-semibold" : "text-gray-400"
                                    )}
                                >
                                    {r === 1 ? '日' : r === 7 ? '周' : '月'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-3">
                        {renderMatrix(matrixC, [59, 130, 246], "认知黄金时段", "蓝色越深，注意力越高")}
                        {renderMatrix(matrixP, [34, 197, 94], "生理活力时段", "绿色越深，活力越高")}
                        {renderMatrix(matrixS, [239, 68, 68], "生理冲动时段", "红色越深，欲望越高")}
                    </div>
                </div>

                {/* Seasonal analysis per dimension */}
                <div className="bg-surface border border-white/10 rounded-2xl p-4 shadow-xl space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-gray-200">季节性分析</div>
                        <div className="text-xs text-gray-500">生理 / 认知 / 冲动</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        {(['spring', 'summer', 'autumn', 'winter'] as const).map(season => (
                            <div key={season} className="bg-white/5 rounded-lg p-3 border border-white/10 space-y-1">
                                <div className="flex items-center justify-between text-gray-300">
                                    <span>{season === 'spring' ? '春' : season === 'summer' ? '夏' : season === 'autumn' ? '秋' : '冬'}</span>
                                </div>
                                <div className="flex justify-between text-[11px]">
                                    <span className="text-green-400 font-semibold">P {seasonStats[season].p ? seasonStats[season].p.toFixed(1) : '-'}</span>
                                    <span className="text-blue-400 font-semibold">C {seasonStats[season].c ? seasonStats[season].c.toFixed(1) : '-'}</span>
                                    <span className="text-red-400 font-semibold">S {seasonStats[season].s ? seasonStats[season].s.toFixed(1) : '-'}</span>
                                </div>
                                <div className="text-[11px] text-gray-500">按季节汇总均值，帮助规划作息与策略。</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Landscape View */}
                <LandscapeChart logs={allHistoryLogs} />
            </div>

            {/* Help Modal */}
            {showHelp && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowHelp(false)}>
                    <div className="bg-surface border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">Evaluation Standards</h3>
                            <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <div className="space-y-4 text-sm text-gray-300">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                    <span className="font-bold text-green-400">P - Physical (Wakefulness)</span>
                                </div>
                                <p className="text-xs text-gray-500 pl-5">
                                    1 = Exhausted / Sleepy<br />
                                    5 = Normal / Awake<br />
                                    10 = Manic / High Energy
                                </p>
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                    <span className="font-bold text-blue-400">C - Cognitive (Focus)</span>
                                </div>
                                <p className="text-xs text-gray-500 pl-5">
                                    1 = Scattered<br />
                                    5 = Focused<br />
                                    10 = Flow State / Hyperfocus
                                </p>
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                    <span className="font-bold text-red-400">S - Impulse (Drive)</span>
                                </div>
                                <p className="text-xs text-gray-500 pl-5">
                                    1 = Sage / Detached<br />
                                    5 = Balanced<br />
                                    10 = Primal / High Craving
                                </p>
                            </div>
                            <div className="pt-2 border-t border-white/10 mt-2">
                                <p className="text-[10px] text-gray-600 italic">
                                    * Dashed lines represent your dynamic baseline (expected value).<br />
                                    * Solid lines represent your actual recorded data.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
