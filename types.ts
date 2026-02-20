export interface ThesisInfo {
  title: string;
  topic: string;
  currentSection?: string; // 當前撰寫的文獻探討小節
}

export interface FileData {
  name: string;
  type: string;
  base64: string;
  pageRange?: string; // 頁碼範圍，例如 "5-10" 或 "5,7,9-12"
}

export enum Step {
  API_KEYS = 0,
  THESIS_INFO = 1,
  UPLOAD_REFS = 2,
  UPLOAD_STYLE = 3,
  ANALYSIS = 4,
  DRAFT = 5,
}

export interface ApiKeyStatus {
  key: string;
  status: 'available' | 'active' | 'exhausted' | 'error';
  lastUsed?: number;
  requestCount: number;
  lastResetDate: string; // ISO date string for daily reset
  errorMessage?: string;
}

export interface AnalysisResult {
  markdown: string;
}

export interface DraftResult {
  markdown: string;
}
