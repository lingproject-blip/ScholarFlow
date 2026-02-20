import React from 'react';

interface ProgressBarProps {
    current: number;
    total: number;
    label?: string;
    currentItem?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
    current,
    total,
    label = '處理中',
    currentItem
}) => {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">{label}</span>
                <span className="text-sm font-semibold text-indigo-600">
                    {current} / {total} ({percentage}%)
                </span>
            </div>

            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                <div
                    className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-3 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${percentage}%` }}
                />
            </div>

            {currentItem && (
                <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>正在處理: {currentItem}</span>
                </div>
            )}
        </div>
    );
};
