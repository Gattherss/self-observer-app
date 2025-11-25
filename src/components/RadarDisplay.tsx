import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { TrinityValue } from '../types';

interface RadarDisplayProps {
    values: TrinityValue;
    size?: number;
    className?: string;
    showLabels?: boolean;
}

export const RadarDisplay: React.FC<RadarDisplayProps> = ({
    values,
    size = 200,
    className = "",
    showLabels = true
}) => {
    // Fallback to zeros if values is missing to avoid NaN in SVG
    const safeValues = values ?? { p: 0, c: 0, s: 0 };
    const center = size / 2;
    const radius = (size / 2) * 0.8; // 80% of container to leave room for labels

    // Calculate points
    const points = useMemo(() => {
        const getPoint = (value: number, angleDeg: number) => {
            const safe = Number.isFinite(value) ? Math.max(0, Math.min(10, value)) : 0;
            const angleRad = (angleDeg - 90) * (Math.PI / 180); // -90 to start at top
            const dist = (safe / 10) * radius;
            return {
                x: center + dist * Math.cos(angleRad),
                y: center + dist * Math.sin(angleRad)
            };
        };

        const p = getPoint(safeValues.p, 0);   // Top
        const c = getPoint(safeValues.c, 120); // Bottom Right
        const s = getPoint(safeValues.s, 240); // Bottom Left

        return { p, c, s };
    }, [safeValues, center, radius]);

    // Background triangles (grid)
    const gridLevels = [2, 4, 6, 8, 10];

    return (
        <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
            <svg width={size} height={size} className="overflow-visible">
                {/* Grid Lines */}
                {gridLevels.map((level) => {
                    const scale = level / 10;
                    const r = radius * scale;
                    const p1 = { x: center, y: center - r };
                    const p2 = { x: center + r * Math.cos(30 * Math.PI / 180), y: center + r * Math.sin(30 * Math.PI / 180) };
                    const p3 = { x: center - r * Math.cos(30 * Math.PI / 180), y: center + r * Math.sin(30 * Math.PI / 180) };

                    return (
                        <polygon
                            key={level}
                            points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`}
                            fill="none"
                            stroke="rgba(255,255,255,0.1)"
                            strokeWidth="1"
                        />
                    );
                })}

                {/* Axes */}
                <line x1={center} y1={center} x2={center} y2={center - radius} stroke="rgba(255,255,255,0.1)" />
                <line x1={center} y1={center} x2={center + radius * Math.cos(30 * Math.PI / 180)} y2={center + radius * Math.sin(30 * Math.PI / 180)} stroke="rgba(255,255,255,0.1)" />
                <line x1={center} y1={center} x2={center - radius * Math.cos(30 * Math.PI / 180)} y2={center + radius * Math.sin(30 * Math.PI / 180)} stroke="rgba(255,255,255,0.1)" />

                {/* Data Polygon */}
                <motion.polygon
                    points={`${points.p.x},${points.p.y} ${points.c.x},${points.c.y} ${points.s.x},${points.s.y}`}
                    fill="rgba(59, 130, 246, 0.2)" // Primary color with opacity
                    stroke="#3b82f6"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    initial={false}
                    animate={{
                        points: `${points.p.x},${points.p.y} ${points.c.x},${points.c.y} ${points.s.x},${points.s.y}`
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                />

                {/* Data Points */}
                <motion.circle cx={points.p.x} cy={points.p.y} r="4" fill="#22c55e" animate={{ cx: points.p.x, cy: points.p.y }} />
                <motion.circle cx={points.c.x} cy={points.c.y} r="4" fill="#3b82f6" animate={{ cx: points.c.x, cy: points.c.y }} />
                <motion.circle cx={points.s.x} cy={points.s.y} r="4" fill="#ef4444" animate={{ cx: points.s.x, cy: points.s.y }} />
            </svg>

            {/* Labels */}
            {showLabels && (
                <>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-4 text-accent font-bold text-xs tracking-wider">PHYSICAL</div>
                    <div className="absolute bottom-[15%] right-0 translate-x-2 text-primary font-bold text-xs tracking-wider">COGNITIVE</div>
                    <div className="absolute bottom-[15%] left-0 -translate-x-2 text-secondary font-bold text-xs tracking-wider">IMPULSE</div>
                </>
            )}
        </div>
    );
};
