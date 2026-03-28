export interface StyleProfile {
  sentenceStyle: string;       // 句型特徵
  vocabulary: string;          // 常用詞彙與學術用語
  paragraphStructure: string;  // 段落架構與開頭/結尾句式
  tone: string;                // 語氣與客觀性
  citationStyle: string;       // 引用格式與密度
  logicFlow: string;           // 論點展開的邏輯順序
  structuralOutline: string;   // 標題與整體結構大綱
  otherFeatures: string;       // 其他特色
  summary: string;             // 綜合風格摘要（一段話）
}

export interface ThesisInfo {
  title: string;
  topic: string;
  currentSection?: string; // 當前撰寫的文獻探討小節
}

export interface FileData {
  name: string;
  type: string;
  base64?: string;
  textContent?: string;
  pageRange?: string; // 頁碼範圍，例如 "5-10" 或 "5,7,9-12"
}

export enum Step {
  API_KEYS = 0,
  THESIS_INFO = 1,
  UPLOAD_THESIS = 2,
  UPLOAD_REFS = 3,
  UPLOAD_STYLE = 4,
  ANALYSIS = 5,
  DRAFT = 6,
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
