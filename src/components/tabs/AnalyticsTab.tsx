import React, { useEffect, useMemo, useState } from 'react';
import { Info, X } from 'lucide-react';
import { startOfDay, endOfDay, startOfWeek, addWeeks, addDays, startOfMonth, endOfMonth, subMonths, format, differenceInCalendarDays } from 'date-fns';
import { useStore } from '../../store';
import { AnalyticsCharts } from '../AnalyticsCharts';
import { LandscapeChart } from '../LandscapeChart';
import { RadarDisplay } from '../RadarDisplay';
import { processChartData, type ChartDataPoint } from '../../utils/analytics';
import type { LogEntry, TrinityValue } from '../../types';
import { storage } from '../../services/storage';
import { UI_TEXT } from '../../utils/constants';
import { cn } from '../../utils/cn';
import { DEFAULT_BASELINE, computeMedianStats, getMonthKey } from '../../utils/baseline';

type HeatView = 'p' | 'c' | 's';

const HEAT_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_STARTS_ON: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1;
const alignToWeekStart = (date: Date) => startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON }).getTime();

const seasonOfMonth = (m: number) => {
    if (m === 11 || m === 0 || m === 1) return 'winter';
    if (m >= 2 && m <= 4) return 'spring';
    if (m >= 5 && m <= 7) return 'summer';
    return 'autumn';
};

const buildMatrix = (
    logs: LogEntry[],
    accessor: (log: LogEntry) => number,
    startTs: number,
    days: number,
    tag: string | 'all'
) => {
    const endTs = startTs + days * DAY_MS;
    const matrix = Array.from({ length: days }, () => Array(24).fill(0));
    const counts = Array.from({ length: days }, () => Array(24).fill(0));

    logs.forEach(log => {
        if (log.timestamp < startTs || log.timestamp >= endTs) return;
        if (tag !== 'all' && !(log.tags || []).includes(tag)) return;
        const d = new Date(log.timestamp);
        const hour = d.getHours();
        const dayIndex = Math.min(days - 1, Math.max(0, Math.floor((d.getTime() - startTs) / DAY_MS)));
        matrix[dayIndex][hour] += accessor(log);
        counts[dayIndex][hour] += 1;
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

    // Baseline states
    const [lastMonthBaseline, setLastMonthBaseline] = useState<{ monthKey: string; values: TrinityValue; sample: number; lowConfidence: boolean }>({
        monthKey: '',
        values: DEFAULT_BASELINE,
        sample: 0,
        lowConfidence: true,
    });
    const [currentMonthStats, setCurrentMonthStats] = useState<{ values: TrinityValue; sample: number; lowConfidence: boolean }>({
        values: DEFAULT_BASELINE,
        sample: 0,
        lowConfidence: true,
    });
    const [lastMonthLogs, setLastMonthLogs] = useState<LogEntry[]>([]);
    const [allHistoryLogs, setAllHistoryLogs] = useState<LogEntry[]>([]);
    const [availableTags, setAvailableTags] = useState<string[]>([]);
    const [selectedTag, setSelectedTag] = useState<string>('all');
    const [baselineConfidence, setBaselineConfidence] = useState<number>(0);

    // Heatmap
    const [heatView, setHeatView] = useState<HeatView>('c');
    const clampHeatStart = (date: Date) => {
        const currentWeekStart = alignToWeekStart(new Date());
        return Math.min(alignToWeekStart(date), currentWeekStart);
    };
    const [heatStart, setHeatStart] = useState<number>(() => clampHeatStart(new Date()));

    // Collapsible and help
    const [showHelp, setShowHelp] = useState(false);
    const [showBaseline, setShowBaseline] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            const now = new Date();
            const todayStart = startOfDay(now).getTime();
            const todayEnd = endOfDay(now).getTime();

            const todayLogsRaw = await storage.getLogs(todayStart, todayEnd);

            const lastMonthDate = subMonths(now, 1);
            const lastMonthStart = startOfMonth(lastMonthDate).getTime();
            const lastMonthEnd = endOfMonth(lastMonthDate).getTime();
            const thisMonthStart = startOfMonth(now).getTime();

            let lastMonthLogsFetched = await storage.getLogs(lastMonthStart, lastMonthEnd);
            let currentMonthLogs = await storage.getLogs(thisMonthStart, now.getTime());
            const allLogs = await storage.getLogs(0, now.getTime());

            // Apply tag filter if not all
            const filterByTag = (logs: LogEntry[]) => {
                if (selectedTag === 'all') return logs;
                return logs.filter(l => (l.tags || []).includes(selectedTag));
            };
            lastMonthLogsFetched = filterByTag(lastMonthLogsFetched);
            currentMonthLogs = filterByTag(currentMonthLogs);
            const todayLogs = filterByTag(todayLogsRaw);

            setLastMonthLogs(lastMonthLogsFetched);
            setAllHistoryLogs(allLogs);
            const tagSet = new Set<string>();
            allLogs.forEach(l => (l.tags || []).forEach(t => t && tagSet.add(t)));
            setAvailableTags(Array.from(tagSet));

            const lastMonthKey = getMonthKey(lastMonthDate);
            const lastMonthStats = computeMedianStats(lastMonthLogsFetched);
            await storage.saveBaseline({
                monthKey: lastMonthKey,
                values: lastMonthStats.values,
                sample: lastMonthStats.sample,
                lowConfidence: lastMonthStats.lowConfidence,
                computedAt: Date.now(),
            });
            setLastMonthBaseline({
                monthKey: lastMonthKey,
                values: lastMonthStats.values,
                sample: lastMonthStats.sample,
                lowConfidence: lastMonthStats.lowConfidence,
            });

            const currentStats = computeMedianStats(currentMonthLogs);
            setCurrentMonthStats(currentStats);

            const days = differenceInCalendarDays(endOfMonth(lastMonthDate), startOfMonth(lastMonthDate)) + 1;
            const ratio = Math.min(1, lastMonthStats.sample / Math.max(1, days));
            setBaselineConfidence(Math.round(ratio * 100));

            const processed = processChartData(todayLogs, lastMonthLogsFetched);
            setChartData(processed);
        };
        loadData();
    }, [recentLogs, selectedTag]);

    // Display values (radar)
    const displayValues = useMemo(() => {
        if (hoverValues) return hoverValues;
        if (recentLogs.length > 0) return recentLogs[recentLogs.length - 1].values;
        return { p: 5, c: 5, s: 5 };
    }, [hoverValues, recentLogs]);

    const formatDelta = (val: number) => {
        const sign = val > 0 ? '+' : '';
        return `${sign}${val.toFixed(1)}`;
    };

    const monthDelta = useMemo<TrinityValue>(() => {
        return {
            p: currentMonthStats.values.p - lastMonthBaseline.values.p,
            c: currentMonthStats.values.c - lastMonthBaseline.values.c,
            s: currentMonthStats.values.s - lastMonthBaseline.values.s,
        };
    }, [currentMonthStats.values, lastMonthBaseline.values]);

    const matrixP = useMemo(() => buildMatrix(lastMonthLogs, l => l.values.p, heatStart, HEAT_DAYS, selectedTag), [lastMonthLogs, heatStart, selectedTag]);
    const matrixC = useMemo(() => buildMatrix(lastMonthLogs, l => l.values.c, heatStart, HEAT_DAYS, selectedTag), [lastMonthLogs, heatStart, selectedTag]);
    const matrixS = useMemo(() => buildMatrix(lastMonthLogs, l => l.values.s, heatStart, HEAT_DAYS, selectedTag), [lastMonthLogs, heatStart, selectedTag]);
    const dayLabels = useMemo(() => {
        return Array.from({ length: HEAT_DAYS }).map((_, idx) => {
            const d = addDays(new Date(heatStart), idx);
            return format(d, 'MM.dd');
        });
    }, [heatStart]);
    const heatRangeLabel = useMemo(() => {
        const start = new Date(heatStart);
        const end = addDays(new Date(heatStart), HEAT_DAYS - 1);
        return `${format(start, 'yyyy.MM.dd')} - ${format(end, 'yyyy.MM.dd')}`;
    }, [heatStart]);
    const heatStartInputValue = useMemo(() => format(new Date(heatStart), 'yyyy-MM-dd'), [heatStart]);
    const currentWeekStart = alignToWeekStart(new Date());
    const isCurrentWeek = heatStart === currentWeekStart;
    const canGoNextWeek = heatStart < currentWeekStart;

    const shiftHeatWindow = (deltaWeeks: number) => {
        setHeatStart(prev => clampHeatStart(addWeeks(new Date(prev), deltaWeeks)));
    };

    const handleHeatDateChange = (value: string) => {
        if (!value) return;
        const picked = new Date(`${value}T00:00:00`);
        setHeatStart(clampHeatStart(picked));
    };

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
            <div className="grid grid-cols-8 gap-[1px] text-[9px] text-gray-400">
                <div className="h-4" />
                {dayLabels.map(d => (
                    <div key={d} className="text-center h-4 flex items-center justify-center">{d}</div>
                ))}
                {Array.from({ length: 24 }).map((_, hour) => (
                    <React.Fragment key={hour}>
                        <div className="h-4 flex items-center text-right pr-1">{hour.toString().padStart(2, '0')}</div>
                        {matrix.map((col, day) => (
                            <div
                                key={`${day}-${hour}`}
                                className="h-4 rounded-sm border border-white/5"
                                style={{ backgroundColor: colorScale(col[hour], palette) }}
                                title={`${dayLabels[day]} ${hour}:00 -> ${col[hour] ? col[hour].toFixed(1) : '-'}`}
                            />
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

            {/* Baseline (collapsible) */}
            <div className="bg-surface border border-white/10 rounded-2xl p-4 shadow-xl mb-4">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-gray-300">基准概览</div>
                    <button
                        onClick={() => setShowBaseline(s => !s)}
                        className="text-xs text-gray-400 hover:text-white"
                    >
                        {showBaseline ? '收起' : '展开'}
                    </button>
                </div>
                {showBaseline && (
                    <div className="mt-3 space-y-3">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-sm font-semibold text-gray-300">本月中位数 vs 上月基准</div>
                                <span className="text-[10px] text-gray-500 uppercase">{lastMonthBaseline.monthKey || 'baseline'}</span>
                            </div>
                            <div className="space-y-2">
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                    {(['p', 'c', 's'] as const).map(key => {
                                    const baselineVal = lastMonthBaseline.values[key];
                                    const currentVal = currentMonthStats.values[key];
                                    const deltaVal = monthDelta[key];
                                    const color = key === 'p' ? 'text-green-400' : key === 'c' ? 'text-blue-400' : 'text-red-400';
                                    return (
                                        <div key={key} className="bg-white/5 rounded-lg p-2 border border-white/5">
                                            <div className="flex items-center justify-between text-gray-400">
                                                <span className="uppercase font-bold">{key}</span>
                                                <span className="text-[10px] text-gray-500">基准 {baselineVal.toFixed(1)}</span>
                                            </div>
                                            <div className="flex items-center justify-between mt-1">
                                                <span className={cn("text-sm font-semibold", color)}>{currentVal.toFixed(1)}</span>
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
                                <div className="text-xs text-gray-400 mt-1">
                                    基准样本：{lastMonthBaseline.sample} 条（{lastMonthBaseline.monthKey || '—'}），可信度 {baselineConfidence}%{lastMonthBaseline.lowConfidence ? '，样本较少仅供参考' : ''}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/5 rounded-xl p-3 border border-white/10 space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-semibold text-gray-300">筛选</div>
                                <div className="text-[11px] text-gray-500">标签</div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
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
                                    <span className="text-xs text-gray-600">暂无标签可筛选</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}
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
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                            <div className="text-sm font-semibold text-gray-200">情绪热图（上月数据）</div>
                            <div className="text-xs text-gray-500">
                                以 7 天为一页，自然周对齐，小时 x 日期；叠加标签密度
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-3">
                            <div className="flex flex-wrap items-center gap-2 justify-end">
                                <button
                                    className="px-2 py-1 rounded border border-white/10 text-xs hover:border-white/30"
                                    onClick={() => shiftHeatWindow(-1)}
                                    title="上一周"
                                >
                                    &lt;
                                </button>
                                <div className="text-xs text-gray-400">
                                    {heatRangeLabel}
                                </div>
                                <button
                                    className="px-2 py-1 rounded border border-white/10 text-xs hover:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed"
                                    onClick={() => shiftHeatWindow(1)}
                                    disabled={!canGoNextWeek}
                                    title="下一周"
                                >
                                    &gt;
                                </button>
                                <input
                                    type="date"
                                    value={heatStartInputValue}
                                    onChange={(e) => handleHeatDateChange(e.target.value)}
                                    className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-200 focus:outline-none"
                                    title="选择任意日期，自动对齐到所在周"
                                />
                                <button
                                    className="px-2 py-1 rounded border border-white/10 text-xs hover:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed"
                                    onClick={() => setHeatStart(clampHeatStart(new Date()))}
                                    disabled={isCurrentWeek}
                                >
                                    回到本周
                                </button>
                            </div>
                            <div className="flex bg-white/5 rounded-lg overflow-hidden border border-white/10 text-xs">
                                {[
                                    { id: 'c', label: 'C 认知', active: "bg-primary text-black border-primary" },
                                    { id: 'p', label: 'P 身体', active: "bg-green-500 text-black border-green-500" },
                                    { id: 's', label: 'S 冲动', active: "bg-red-500 text-black border-red-500" },
                                ].map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setHeatView(opt.id as HeatView)}
                                        className={cn(
                                            "px-3 py-1 border-r border-white/10 last:border-r-0",
                                            heatView === opt.id ? opt.active : "text-gray-400"
                                        )}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {heatView === 'c' && renderMatrix(matrixC, [59, 130, 246], "认知黄金时段", "蓝色越深，注意力越高")}
                        {heatView === 'p' && renderMatrix(matrixP, [34, 197, 94], "生理活力时段", "绿色越深，活力越高")}
                        {heatView === 's' && renderMatrix(matrixS, [239, 68, 68], "冲动强度时段", "红色越深，欲望越高")}
                    </div>
                </div>

                {/* Seasonal analysis per dimension */}
                <div className="bg-surface border border-white/10 rounded-2xl p-4 shadow-xl space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-gray-200">季节性分析</div>
                        <div className="text-xs text-gray-500">身体 / 认知 / 冲动</div>
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
                                <div className="text-[11px] text-gray-500">按季节看平均水平，用于参考规划。</div>
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
