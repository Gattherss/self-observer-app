import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useHaptics } from '../hooks/useHaptics';

interface InputSliderProps {
    label: string;
    value: number;
    onChange: (val: number) => void;
    color: string; // hex color
    min?: number;
    max?: number;
    statusText?: string;
}

export const InputSlider: React.FC<InputSliderProps> = ({
    label,
    value,
    onChange,
    color,
    min = 1,
    max = 10,
    statusText
}) => {
    const { trigger } = useHaptics();
    const lastIntRef = useRef(Math.floor(value));

    useEffect(() => {
        const currentInt = Math.floor(value);
        if (currentInt !== lastIntRef.current) {
            trigger(5); // Light tick on integer change
            lastIntRef.current = currentInt;
        }
    }, [value, trigger]);

    return (
        <div className="w-full mb-6">
            <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-300 tracking-wide">{label}</span>
                <div className="flex items-center gap-2">
                    {statusText && (
                        <span className="text-sm sm:text-xs font-medium" style={{ color: color, opacity: 0.8 }}>
                            {statusText}
                        </span>
                    )}
                    <span className="text-lg font-bold" style={{ color }}>{value}</span>
                </div>
            </div>
            <div className="relative h-8 flex items-center">
                {/* Track */}
                <div className="absolute w-full h-2 bg-surface rounded-full overflow-hidden">
                    <motion.div
                        className="h-full rounded-full opacity-50"
                        style={{ backgroundColor: color }}
                        initial={false}
                        animate={{ width: `${((value - min) / (max - min)) * 100}%` }}
                    />
                </div>

                {/* Input Range (Invisible but interactive) */}
                <input
                    type="range"
                    min={min}
                    max={max}
                    step="0.1"
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                />

                {/* Thumb (Visual) */}
                <motion.div
                    className="absolute h-6 w-6 rounded-full border-2 border-white shadow-lg pointer-events-none"
                    style={{ backgroundColor: color, left: `calc(${((value - min) / (max - min)) * 100}% - 12px)` }}
                    animate={{ left: `calc(${((value - min) / (max - min)) * 100}% - 12px)` }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
            </div>
        </div>
    );
};
