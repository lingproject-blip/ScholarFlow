import React from 'react';
import { ApiKeyStatus as ApiKeyStatusType } from '../types';

interface ApiKeyStatusProps {
    keyStatuses: ApiKeyStatusType[];
    currentIndex: number;
}

export const ApiKeyStatus: React.FC<ApiKeyStatusProps> = ({ keyStatuses, currentIndex }) => {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'available':
                return 'bg-green-500';
            case 'active':
                return 'bg-yellow-500';
            case 'exhausted':
                return 'bg-red-500';
            case 'error':
                return 'bg-gray-500';
            default:
                return 'bg-gray-300';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'available':
                return '可用';
            case 'active':
                return '使用中';
            case 'exhausted':
                return '已耗盡';
            case 'error':
                return '錯誤';
            default:
                return '未知';
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700">API Key 狀態</h3>
                <span className="text-xs text-slate-500">
                    當前使用: #{currentIndex + 1}
                </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-2">
                {keyStatuses.map((keyStatus, index) => (
                    <div
                        key={index}
                        className={`
              relative flex flex-col items-center p-2 rounded-lg border-2 transition-all
              ${index === currentIndex ? 'border-indigo-500 bg-indigo-50' : 'border-transparent bg-slate-50'}
            `}
                        title={keyStatus.errorMessage || getStatusText(keyStatus.status)}
                    >
                        <div className="flex items-center gap-1 mb-1">
                            <div className={`w-3 h-3 rounded-full ${getStatusColor(keyStatus.status)} animate-pulse`} />
                            <span className="text-xs font-medium text-slate-700">#{index + 1}</span>
                        </div>

                        <span className="text-[10px] text-slate-500 text-center leading-tight">
                            {getStatusText(keyStatus.status)}
                        </span>

                        {keyStatus.requestCount > 0 && (
                            <span className="text-[9px] text-slate-400 mt-0.5">
                                {keyStatus.requestCount} 次
                            </span>
                        )}
                    </div>
                ))}
            </div>

            <div className="mt-3 pt-3 border-t border-slate-200">
                <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span>可用</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                        <span>使用中</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span>已耗盡</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-gray-500" />
                        <span>錯誤</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
