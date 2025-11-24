import React, { useEffect, useMemo, useState } from "react";
import { Info, X, ChevronDown } from "lucide-react";
import { startOfDay, endOfDay } from "date-fns";
import { useStore } from "../../store";
import { AnalyticsCharts } from "../AnalyticsCharts";
import { RadarDisplay } from "../RadarDisplay";
import { LandscapeChart } from "../LandscapeChart";
import { CombinedView3D } from "../CombinedView3D";
import { processChartData, type ChartDataPoint } from "../../utils/analytics";
import type { LogEntry, TrinityValue } from "../../types";
import { storage } from "../../services/storage";
import { UI_TEXT } from "../../utils/constants";
import { cn } from "../../utils/cn";

type DayType = "all" | "weekday" | "weekend";
type HeatRange = 1 | 7 | 30;

const clamp = (v: number, min = 0, max = 10) => Math.max(min, Math.min(max, v));

const summarizeState = (p: number, c: number, s: number) => {
    if (p >= 8 && c >= 8 && s <= 4) return "高能专注";
    if (p <= 4 && c <= 4 && s <= 4) return "低能休整";
    if (s >= 7 && c <= 5) return "冲动偏高";
    if (c >= 7 && p >= 6 && s <= 6) return "深度工作友好";
    if (p >= 6 && s >= 6) return "社交/运动适合";
    return "常规";
};

const getHeatmapColor = (p: number, c: number, s: number) => {
    // 优先级：冲动欲望 > 认知黄金 > 生理/精力黄金
    if (s >= 6.5) {
        // 冲动：红色，深浅随强度
        const alpha = Math.min(1, (s - 6) / 4);
        return `rgba(239, 68, 68, ${alpha})`; // red-500
    }
    if (c >= 6.5) {
        // 认知黄金：蓝色
        const alpha = Math.min(1, (c - 6) / 4);
        return `rgba(59, 130, 246, ${alpha})`; // blue-500
    }
    if (p >= 6.5) {
        // 生理黄金：绿色
        const alpha = Math.min(1, (p - 6) / 4);
        return `rgba(34, 197, 94, ${alpha})`; // green-500
    }
    return "rgba(255, 255, 255, 0.05)"; // 默认微弱白
};

const buildHeatmapData = (logs: LogEntry[], days: number) => {
    const data: { date: string; hours: { p: number; c: number; s: number; count: number }[] }[] = [];
    const now = new Date();

    for (let d = 0; d < days; d++) {
        const date = new Date(now);
        date.setDate(date.getDate() - d);
        const dateStr = date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });

        // Initialize 24 hours
        const hours = Array.from({ length: 24 }, () => ({ p: 0, c: 0, s: 0, count: 0 }));
        data.push({ date: dateStr, hours });
    }

    logs.forEach(l => {
        const logDate = new Date(l.timestamp);
        const diffTime = Math.abs(now.getTime() - logDate.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < days) {
            const hour = logDate.getHours();
            const dayIndex = diffDays; // 0 is today
            if (data[dayIndex]) {
                const hData = data[dayIndex].hours[hour];
                hData.p += l.values.p;
                hData.c += l.values.c;
                hData.s += l.values.s;
                hData.count += 1;
            }
        }
    });

    // Average
    data.forEach(d => {
        d.hours.forEach(h => {
            if (h.count > 0) {
                h.p /= h.count;
                h.c /= h.count;
                h.s /= h.count;
            }
        });
    });

    return data;
};

const buildHourMap = (logs: LogEntry[], days: number) => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const buckets = Array.from({ length: 24 }, () => [] as LogEntry[]);
    logs.forEach(l => {
        if (l.timestamp < cutoff) return;
        const h = new Date(l.timestamp).getHours();
        buckets[h].push(l);
    });
    return buckets.map(list => {
        if (!list.length) return { p: 0, c: 0, s: 0, count: 0 };
        const sum = list.reduce((acc, l) => ({
            p: acc.p + l.values.p,
            c: acc.c + l.values.c,
            s: acc.s + l.values.s,
        }), { p: 0, c: 0, s: 0 });
        return {
            p: sum.p / list.length,
            c: sum.c / list.length,
            s: sum.s / list.length,
            count: list.length
        };
    });
};

export const AnalyticsTab: React.FC = () => {
    const { recentLogs } = useStore();

    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [hoverValues, setHoverValues] = useState<TrinityValue | null>(null);
    const [hoverDelta, setHoverDelta] = useState<TrinityValue | null>(null);
    const [hoverTime, setHoverTime] = useState<string | null>(null);

    const [baselineDays, setBaselineDays] = useState<7 | 30>(30);
    const [dayType, setDayType] = useState<DayType>("all");
    const [availableTags, setAvailableTags] = useState<string[]>([]);
    const [selectedTag, setSelectedTag] = useState<string>("all");
    const [baselineSample, setBaselineSample] = useState(0);

    const [history, setHistory] = useState<LogEntry[]>([]);
    const [heatRange, setHeatRange] = useState<HeatRange>(7);
    const [openMap, setOpenMap] = useState(true);
    const [openCombo, setOpenCombo] = useState(false);
    const [fullscreen3D, setFullscreen3D] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            const start = startOfDay(new Date()).getTime();
            const end = endOfDay(new Date()).getTime();
            const today = await storage.getLogs(start, end);

            const historyStart = start - baselineDays * 24 * 60 * 60 * 1000;
            let baseLogs = await storage.getLogs(historyStart, start);

            if (dayType !== "all") {
                const isWeekend = (ts: number) => {
                    const d = new Date(ts).getDay();
                    return d === 0 || d === 6;
                };
                baseLogs = baseLogs.filter(l => dayType === "weekend" ? isWeekend(l.timestamp) : !isWeekend(l.timestamp));
            }

            const filterTag = (logs: LogEntry[]) => selectedTag === "all" ? logs : logs.filter(l => (l.tags || []).includes(selectedTag));

            const todayFiltered = filterTag(today);
            const baseFiltered = filterTag(baseLogs);
            setBaselineSample(baseFiltered.length);

            const processed = processChartData(todayFiltered, baseFiltered);
            setChartData(processed);

            const allLogs = await storage.getLogs(0, end);
            setHistory(filterTag(allLogs));

            const tagSet = new Set<string>();
            allLogs.forEach(l => (l.tags || []).forEach(t => t && tagSet.add(t)));
            setAvailableTags(Array.from(tagSet));
        };
        loadData();
    }, [recentLogs, baselineDays, dayType, selectedTag]);

    const displayValues = useMemo(() => {
        if (hoverValues) return hoverValues;
        if (recentLogs.length > 0) return recentLogs[recentLogs.length - 1].values;
        return { p: 5, c: 5, s: 5 };
    }, [hoverValues, recentLogs]);

    const latestPoint = useMemo(() => [...chartData].reverse().find(p => p.p_actual !== null || p.c_actual !== null || p.s_actual !== null), [chartData]);
    const latestDelta = useMemo(() => latestPoint ? {
        p: (latestPoint.p_actual ?? latestPoint.p_baseline) - latestPoint.p_baseline,
        c: (latestPoint.c_actual ?? latestPoint.c_baseline) - latestPoint.c_baseline,
        s: (latestPoint.s_actual ?? latestPoint.s_baseline) - latestPoint.s_baseline,
    } : null, [latestPoint]);

    const heatFiltered = useMemo(() => {
        const cutoff = Date.now() - heatRange * 24 * 60 * 60 * 1000;
        let logs = history.filter(l => l.timestamp >= cutoff);
        if (dayType !== "all") {
            const isWeekend = (ts: number) => {
                const d = new Date(ts).getDay();
                return d === 0 || d === 6;
            };
            logs = logs.filter(l => dayType === "weekend" ? isWeekend(l.timestamp) : !isWeekend(l.timestamp));
        }
        return logs;
    }, [history, heatRange, dayType]);

    // Heatmap Data
    const heatmapData = useMemo(() => buildHeatmapData(history, heatRange), [history, heatRange]);

    const hourMap = useMemo(() => buildHourMap(heatFiltered, heatRange), [heatFiltered, heatRange]);
    const comboList = useMemo(() => hourMap.map((h, idx) => ({
        hour: idx,
        p: clamp(h.p),
        c: clamp(h.c),
        s: clamp(h.s),
        count: h.count,
        desc: h.count > 0 ? summarizeState(clamp(h.p), clamp(h.c), clamp(h.s)) : "暂无数据",
    })), [hourMap]);

    const comboPoints = useMemo(() => comboList.map(item => ({
        hour: item.hour,
        values: { p: item.p, c: item.c, s: item.s },
        count: item.count,
    })), [comboList]);

    const formatDelta = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`;

    return (
        <div className="min-h-full h-full flex flex-col pt-8 pb-24 px-4 overflow-y-auto space-y-4">
            {/* 顶部雷达 + Delta */}
            <div className="flex items-center justify-between">
                <div className="flex-1 flex justify-center relative">
                    <RadarDisplay values={displayValues} size={140} showLabels={false} />
                    <button onClick={() => setShowHelp(true)} className="absolute top-0 right-0 p-2 text-gray-500 hover:text-white">
                        <Info size={16} />
                    </button>
                </div>
                <div className="w-32 text-sm sm:text-xs text-gray-500 uppercase tracking-widest">
                    <div className="mb-2">{hoverTime || "Delta"}</div>
                    {hoverDelta ? (
                        <div className="space-y-1">
                            <div className="flex justify-between"><span className="text-green-500">P</span><span className="text-white">{formatDelta(hoverDelta.p)}</span></div>
                            <div className="flex justify-between"><span className="text-blue-500">C</span><span className="text-white">{formatDelta(hoverDelta.c)}</span></div>
                            <div className="flex justify-between"><span className="text-red-500">S</span><span className="text-white">{formatDelta(hoverDelta.s)}</span></div>
                        </div>
                    ) : <div className="text-gray-600 italic">{UI_TEXT.analytics.noData}</div>}
                </div>
            </div>

            {/* 基准 vs 实际 */}
            <div className="grid grid-cols-1 gap-3">
                <div className="bg-surface border border-white/10 rounded-2xl p-4 shadow-xl">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold text-gray-300">基准 vs 实际</div>
                        <span className="text-[10px] text-gray-500 uppercase">当前</span>
                    </div>
                    {latestPoint ? (
                        <div className="space-y-2">
                            <div className="grid grid-cols-3 gap-2 text-sm sm:text-xs">
                                {["p", "c", "s"].map(key => {
                                    const baselineVal = latestPoint[`${key}_baseline` as keyof ChartDataPoint] as number;
                                    const actualVal = (latestPoint[`${key}_actual` as keyof ChartDataPoint] ?? baselineVal) as number;
                                    const deltaVal = latestDelta?.[key as "p" | "c" | "s"] || 0;
                                    const color = key === "p" ? "text-green-400" : key === "c" ? "text-blue-400" : "text-red-400";
                                    return (
                                        <div key={key} className="bg-white/5 rounded-lg p-2 border border-white/5">
                                            <div className="flex items-center justify-between text-gray-400">
                                                <span className="uppercase font-bold">{key}</span>
                                                <span className="text-[10px] text-gray-500">基准 {baselineVal.toFixed(1)}</span>
                                            </div>
                                            <div className="flex items-center justify-between mt-1">
                                                <span className={cn("text-sm font-semibold", color)}>{actualVal.toFixed(1)}</span>
                                                <span className={cn("text-[11px] font-mono", deltaVal > 0 ? "text-blue-400" : deltaVal < 0 ? "text-red-400" : "text-gray-500")}>{formatDelta(deltaVal)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="text-sm sm:text-xs text-gray-400 mt-1">{(() => {
                                if (!latestDelta) return "";
                                const arr = ["p", "c", "s"].map(k => ({ k, v: latestDelta[k as "p" | "c" | "s"] as number }));
                                const max = arr.sort((a, b) => Math.abs(b.v) - Math.abs(a.v))[0];
                                if (Math.abs(max.v) < 0.2) return "整体接近基准，状态平稳";
                                const label = max.k === "p" ? "生理" : max.k === "c" ? "认知" : "冲动";
                                return `${label}${max.v > 0 ? "高于" : "低于"}基准 ${formatDelta(max.v)}`;
                            })()}</div>
                        </div>
                    ) : <div className="text-sm sm:text-xs text-gray-500">今天还没有数据，先去记录一条吧。</div>}
                </div>

                {/* 基准配置 */}
                <div className="bg-surface border border-white/10 rounded-2xl p-4 shadow-xl space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-gray-300">基准透明度</div>
                        <div className="text-[11px] text-gray-500">{Math.round(Math.min(1, baselineSample / Math.max(1, baselineDays)) * 100)}%</div>
                    </div>
                    <div className="text-[11px] text-gray-500">来源：最近 {baselineDays} 天 · {dayType === "weekday" ? "仅工作日" : dayType === "weekend" ? "仅周末" : "全部"} · 样本 {baselineSample}</div>
                    <div className="flex items-center gap-2 flex-wrap text-sm sm:text-xs">
                        <div className="flex bg-white/5 rounded-lg overflow-hidden border border-white/10">
                            {[7, 30].map(d => (
                                <button key={d} onClick={() => setBaselineDays(d as 7 | 30)} className={cn("px-3 py-1 border-r border-white/10 last:border-r-0", baselineDays === d ? "bg-white text-black font-semibold" : "text-gray-400")}>{d}天</button>
                            ))}
                        </div>
                        <div className="flex bg-white/5 rounded-lg overflow-hidden border border-white/10">
                            {[{ id: "all", label: "全部" }, { id: "weekday", label: "工作日" }, { id: "weekend", label: "周末" }].map(opt => (
                                <button key={opt.id} onClick={() => setDayType(opt.id as DayType)} className={cn("px-3 py-1 border-r border-white/10 last:border-r-0", dayType === opt.id ? "bg-primary/20 text-white font-semibold" : "text-gray-400")}>{opt.label}</button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm sm:text-xs text-gray-500">标签：</span>
                            <button onClick={() => setSelectedTag("all")} className={cn("px-4 py-2 sm:px-3 sm:py-1 rounded-full text-sm sm:text-xs border", selectedTag === "all" ? "bg-primary text-black border-primary" : "border-white/10 text-gray-400")}>全部</button>
                            {availableTags.map(tag => (
                                <button key={tag} onClick={() => setSelectedTag(tag)} className={cn("px-4 py-2 sm:px-3 sm:py-1 rounded-full text-sm sm:text-xs border", selectedTag === tag ? "bg-primary text-black border-primary" : "border-white/10 text-gray-300")}>{tag}</button>
                            ))}
                            {availableTags.length === 0 && <span className="text-sm sm:text-xs text-gray-600">暂无标签</span>}
                        </div>
                    </div>
                </div>
            </div>

            {/* 折线/面积图 */}
            <div className="h-[360px]">
                <AnalyticsCharts
                    data={chartData}
                    onHover={(vals, delta, time) => { setHoverValues(vals); setHoverDelta(delta); setHoverTime(time || null); }}
                    setActiveIndex={() => { }}
                />
            </div>

            {/* 情绪地图 Heatmap */}
            <div className="bg-surface border border-white/10 rounded-2xl p-4 shadow-xl">
                <button className="w-full flex items-center justify-between text-left" onClick={() => setOpenMap(!openMap)}>
                    <div>
                        <div className="text-base sm:text-sm font-semibold text-gray-200">情绪地图 (Heatmap)</div>
                        <div className="text-sm sm:text-xs text-gray-500">黄金时段与冲动时段分布</div>
                    </div>
                    <ChevronDown size={16} className={cn("transition", openMap ? "rotate-180" : "")} />
                </button>
                {openMap && (
                    <div className="mt-4 space-y-4">
                        <div className="flex items-center justify-between text-sm sm:text-xs text-gray-400">
                            <div className="flex gap-2">
                                {[7, 30].map(d => (
                                    <button key={d} onClick={() => setHeatRange(d as HeatRange)} className={cn("px-2 py-0.5 rounded border", heatRange === d ? "bg-white text-black border-white" : "border-white/10")}>{d}天</button>
                                ))}
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div>认知黄金</div>
                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div>生理黄金</div>
                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div>冲动</div>
                            </div>
                        </div>

                        <div className="overflow-x-auto pb-2">
                            <div className="min-w-[500px]">
                                {/* Header Hours */}
                                <div className="flex mb-1">
                                    <div className="w-12 shrink-0"></div>
                                    {Array.from({ length: 24 }).map((_, i) => (
                                        <div key={i} className="flex-1 text-[9px] text-center text-gray-600">{i}</div>
                                    ))}
                                </div>
                                {/* Rows */}
                                {heatmapData.map((day, dIdx) => (
                                    <div key={dIdx} className="flex items-center h-6 mb-0.5">
                                        <div className="w-12 shrink-0 text-[9px] text-gray-500 text-right pr-2">{day.date}</div>
                                        {day.hours.map((h, hIdx) => (
                                            <div
                                                key={hIdx}
                                                className="flex-1 h-full mx-[1px] rounded-sm relative group"
                                                style={{ backgroundColor: h.count > 0 ? getHeatmapColor(h.p, h.c, h.s) : 'rgba(255,255,255,0.02)' }}
                                            >
                                                {/* Tooltip */}
                                                <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-black/90 text-white text-[10px] p-2 rounded whitespace-nowrap z-10 border border-white/10 pointer-events-none">
                                                    <div className="font-bold mb-1">{day.date} {hIdx}:00</div>
                                                    {h.count > 0 ? (
                                                        <>
                                                            <div className="text-green-400">P 生理: {h.p.toFixed(1)}</div>
                                                            <div className="text-blue-400">C 认知: {h.c.toFixed(1)}</div>
                                                            <div className="text-red-400">S 冲动: {h.s.toFixed(1)}</div>
                                                        </>
                                                    ) : "无数据"}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 综合视图 + 3D */}
            <div className="bg-surface border border-white/10 rounded-2xl p-4 shadow-xl">
                <button className="w-full flex items-center justify-between text-left" onClick={() => setOpenCombo(!openCombo)}>
                    <div>
                        <div className="text-sm font-semibold text-gray-200">综合视图</div>
                        <div className="text-sm sm:text-xs text-gray-500">小时均值 + 规则总结 + 3D 散点</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); setFullscreen3D(true); }}
                            className="px-2 py-1 text-[11px] bg-white/10 border border-white/10 rounded-lg hover:bg-white/20"
                        >
                            全屏
                        </button>
                        <ChevronDown size={16} className={cn("transition", openCombo ? "rotate-180" : "")} />
                    </div>
                </button>
                {openCombo && (
                    <div className="mt-3 space-y-3 text-sm sm:text-xs text-gray-300">
                        <div className="max-h-56 overflow-y-auto pr-1 space-y-1">
                            {comboList.map(item => (
                                <div key={item.hour} className="bg-white/5 rounded-lg p-2 border border-white/10 flex items-center justify-between">
                                    <div>
                                        <div className="font-semibold text-gray-200">{item.hour.toString().padStart(2, "0")}:00</div>
                                        <div className="text-[11px] text-gray-400">{item.desc}</div>
                                    </div>
                                    <div className="text-[11px] text-right">
                                        <div>P {item.p.toFixed(1)}</div>
                                        <div>C {item.c.toFixed(1)}</div>
                                        <div>S {item.s.toFixed(1)}</div>
                                        <div className="text-gray-500">样本 {item.count}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="h-[320px] w-full">
                            <CombinedView3D points={comboPoints} height={320} />
                            <div className="text-[11px] text-gray-500 mt-1">
                                映射：X=小时(居中-12) · Y=生理 · Z=认知 · 颜色=冲动（红高蓝低）。可拖拽旋转缩放。
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 历史总览 */}
            <LandscapeChart logs={history} />

            {showHelp && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowHelp(false)}>
                    <div className="bg-surface border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">评分说明</h3>
                            <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <div className="space-y-3 text-sm text-gray-300">
                            <div>P 生理：1 疲劳 / 5 正常 / 10 很高</div>
                            <div>C 认知：1 涣散 / 5 专注 / 10 心流</div>
                            <div>S 冲动：1 平静 / 5 平衡 / 10 很强</div>
                            <div className="text-[11px] text-gray-500">折线图：虚线=基准，实线=实际；情绪地图可折叠。</div>
                        </div>
                    </div>
                </div>
            )}

            {fullscreen3D && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setFullscreen3D(false)}>
                    <div className="bg-surface border border-white/10 rounded-2xl p-4 w-full max-w-4xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-semibold text-gray-200">3D 散点全屏</div>
                            <button onClick={() => setFullscreen3D(false)} className="text-gray-400 hover:text-white text-sm">关闭</button>
                        </div>
                        <CombinedView3D points={comboPoints} height={420} />
                        <div className="text-[11px] text-gray-500 mt-2">
                            映射：X=小时-12，Y=生理，Z=认知，颜色=冲动（红高蓝低）。鼠标/手指拖拽旋转，滚动缩放。
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
