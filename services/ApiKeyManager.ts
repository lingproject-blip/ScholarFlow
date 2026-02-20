import { ApiKeyStatus } from '../types';

export class ApiKeyManager {
    private keys: ApiKeyStatus[];
    private currentIndex: number = 0;
    private listeners: Array<(keys: ApiKeyStatus[]) => void> = [];

    constructor(apiKeys: string[]) {
        const today = new Date().toISOString().split('T')[0];
        this.keys = apiKeys.map(key => ({
            key: key.trim(),
            status: 'available' as const,
            requestCount: 0,
            lastResetDate: today,
        }));
    }

    /**
     * 訂閱狀態變更
     */
    subscribe(listener: (keys: ApiKeyStatus[]) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * 通知所有訂閱者
     */
    private notify() {
        this.listeners.forEach(listener => listener([...this.keys]));
    }

    /**
     * 檢查並重置每日配額
     */
    private checkDailyReset() {
        const today = new Date().toISOString().split('T')[0];
        this.keys.forEach(keyStatus => {
            if (keyStatus.lastResetDate !== today) {
                keyStatus.status = 'available';
                keyStatus.requestCount = 0;
                keyStatus.lastResetDate = today;
                keyStatus.errorMessage = undefined;
            }
        });
    }

    /**
     * 取得當前可用的 API key
     */
    getCurrentKey(): string {
        this.checkDailyReset();
        return this.keys[this.currentIndex].key;
    }

    /**
     * 取得所有 key 的狀態
     */
    getKeyStatuses(): ApiKeyStatus[] {
        this.checkDailyReset();
        return [...this.keys];
    }

    /**
     * 標記當前 key 為使用中
     */
    markAsActive() {
        this.keys[this.currentIndex].status = 'active';
        this.keys[this.currentIndex].lastUsed = Date.now();
        this.notify();
    }

    /**
     * 標記請求成功
     */
    markSuccess() {
        const current = this.keys[this.currentIndex];
        current.status = 'available';
        current.requestCount++;
        current.lastUsed = Date.now();
        this.notify();
    }

    /**
     * 標記當前 key 為已耗盡並切換到下一個
     */
    markExhaustedAndRotate(): boolean {
        this.keys[this.currentIndex].status = 'exhausted';
        this.keys[this.currentIndex].errorMessage = '今日流量已用完';
        this.notify();

        // 尋找下一個可用的 key
        const startIndex = this.currentIndex;
        let attempts = 0;

        while (attempts < this.keys.length) {
            this.currentIndex = (this.currentIndex + 1) % this.keys.length;
            attempts++;

            if (this.keys[this.currentIndex].status === 'available') {
                console.log(`已切換到 API key #${this.currentIndex + 1}`);
                this.notify();
                return true;
            }
        }

        // 所有 keys 都已耗盡
        console.error('所有 API keys 都已耗盡');
        return false;
    }

    /**
     * 標記當前 key 發生錯誤
     */
    markError(error: string) {
        this.keys[this.currentIndex].status = 'error';
        this.keys[this.currentIndex].errorMessage = error;
        this.notify();
    }

    /**
     * 取得當前 key 的索引
     */
    getCurrentIndex(): number {
        return this.currentIndex;
    }

    /**
     * 檢查是否還有可用的 key
     */
    hasAvailableKey(): boolean {
        this.checkDailyReset();
        return this.keys.some(k => k.status === 'available');
    }
}
