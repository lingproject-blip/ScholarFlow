/**
 * apiKeyStorage.ts
 *
 * 安全地將 API key 儲存到 localStorage，採用 XOR + Base64 混淆，
 * 防止爬蟲或自動化工具直接掃描取得明文 key。
 *
 * ⚠️  注意：這是前端混淆，不是加密。目的是阻擋自動化掃描，
 *     而非對手動查看 DevTools 的使用者設防。
 */

const STORAGE_KEY = 'sfk'; // localStorage 的 key 名稱
const DEFAULT_SLOTS = 3;   // 預設欄位數量

// 每次 build 不同但執行期固定的混淆種子（不放在 JS 人眼顯眼處）
const _s = [0x4b, 0x73, 0x63, 0x68, 0x6f, 0x6c, 0x61, 0x72];

/**
 * XOR 混淆字串
 */
function xorTransform(input: string): string {
  const chars = Array.from(input);
  return chars
    .map((ch, i) => String.fromCharCode(ch.charCodeAt(0) ^ _s[i % _s.length]))
    .join('');
}

/**
 * 將 API key 陣列混淆後存入 localStorage
 */
export function saveApiKeys(keys: string[]): void {
  try {
    const json = JSON.stringify(keys);
    const obfuscated = btoa(xorTransform(json));
    localStorage.setItem(STORAGE_KEY, obfuscated);
  } catch {
    // localStorage 不可用（隱私模式等），靜默失敗
  }
}

/**
 * 從 localStorage 讀取並還原 API key 陣列。
 * 若無儲存資料則回傳含 DEFAULT_SLOTS 個空字串的陣列。
 */
export function loadApiKeys(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return Array(DEFAULT_SLOTS).fill('');

    const decoded = xorTransform(atob(raw));
    const parsed: string[] = JSON.parse(decoded);

    if (!Array.isArray(parsed)) return Array(DEFAULT_SLOTS).fill('');

    // 確保至少有 DEFAULT_SLOTS 個欄位
    while (parsed.length < DEFAULT_SLOTS) parsed.push('');
    return parsed;
  } catch {
    return Array(DEFAULT_SLOTS).fill('');
  }
}

/**
 * 清除儲存的 API key（可選用，例如刻意登出時）
 */
export function clearApiKeys(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 靜默失敗
  }
}
