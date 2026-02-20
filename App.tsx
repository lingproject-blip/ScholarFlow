import React, { useState, useRef } from 'react';
import { Layout } from './components/Layout';
import { Button } from './components/Button';
import { FileUpload } from './components/FileUpload';
import { MarkdownView } from './components/MarkdownView';
import { ApiKeyStatus } from './components/ApiKeyStatus';
import { ProgressBar } from './components/ProgressBar';
import { GeminiService } from './services/geminiService';
import { saveApiKeys, loadApiKeys } from './services/apiKeyStorage';
import { Step, FileData, ThesisInfo, ApiKeyStatus as ApiKeyStatusType } from './types';

export default function App() {
  // State
  const [step, setStep] = useState<Step>(Step.API_KEYS);
  const [apiKeys, setApiKeys] = useState<string[]>(() => loadApiKeys());
  const [thesisInfo, setThesisInfo] = useState<ThesisInfo>({ title: '', topic: '', currentSection: '' });
  const [references, setReferences] = useState<FileData[]>([]);
  const [seniorExample, setSeniorExample] = useState<FileData | null>(null);
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [draftResult, setDraftResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyStatuses, setKeyStatuses] = useState<ApiKeyStatusType[]>([]);
  const [currentKeyIndex, setCurrentKeyIndex] = useState<number>(0);
  const [progress, setProgress] = useState<{ current: number; total: number; item: string }>({ current: 0, total: 0, item: '' });

  // Service Ref (persists across renders)
  const geminiService = useRef<GeminiService | null>(null);

  // Handlers
  const handleApiKeyChange = (index: number, value: string) => {
    const newKeys = [...apiKeys];
    newKeys[index] = value;
    setApiKeys(newKeys);
    saveApiKeys(newKeys);
  };

  const addApiKeyField = () => {
    const newKeys = [...apiKeys, ''];
    setApiKeys(newKeys);
    saveApiKeys(newKeys);
  };

  const removeApiKeyField = (index: number) => {
    if (apiKeys.length <= 1) return;
    const newKeys = apiKeys.filter((_, i) => i !== index);
    setApiKeys(newKeys);
    saveApiKeys(newKeys);
  };

  const initializeService = () => {
    const validKeys = apiKeys.filter(k => k.trim().length > 0);
    if (validKeys.length === 0) {
      setError("請至少輸入一組有效的 API 金鑰。");
      return;
    }
    geminiService.current = new GeminiService(validKeys);

    // 訂閱 API key 狀態更新
    const keyManager = geminiService.current.getKeyManager();
    keyManager.subscribe((statuses) => {
      setKeyStatuses(statuses);
      setCurrentKeyIndex(keyManager.getCurrentIndex());
    });

    // 初始化狀態
    setKeyStatuses(keyManager.getKeyStatuses());
    setCurrentKeyIndex(keyManager.getCurrentIndex());

    setStep(Step.THESIS_INFO);
    setError(null);
  };

  const handleAnalysis = async () => {
    if (!geminiService.current) return;
    setIsLoading(true);
    setError(null);
    setProgress({ current: 0, total: references.length, item: '' });
    try {
      const result = await geminiService.current.analyzeReferences(
        thesisInfo.title,
        thesisInfo.topic,
        thesisInfo.currentSection,
        references,
        (current, total, item) => {
          setProgress({ current, total, item });
        }
      );
      setAnalysisResult(result);
      setStep(Step.ANALYSIS);
    } catch (e: any) {
      setError(e.message || "分析失敗。");
    } finally {
      setIsLoading(false);
      setProgress({ current: 0, total: 0, item: '' });
    }
  };

  const handleDrafting = async () => {
    if (!geminiService.current) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await geminiService.current.generateDraft(
        thesisInfo.title,
        thesisInfo.topic,
        thesisInfo.currentSection,
        analysisResult,
        seniorExample
      );
      setDraftResult(result);
      setStep(Step.DRAFT);
    } catch (e: any) {
      setError(e.message || "初稿生成失敗。");
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setStep(Step.THESIS_INFO);
    setReferences([]);
    setSeniorExample(null);
    setAnalysisResult('');
    setDraftResult('');
    setError(null);
  };

  const resetToHome = () => {
    setStep(Step.API_KEYS);
    // 注意：故意不清除 apiKeys state（保留 localStorage 中的 key）
    setThesisInfo({ title: '', topic: '', currentSection: '' });
    setReferences([]);
    setSeniorExample(null);
    setAnalysisResult('');
    setDraftResult('');
    setError(null);
    setKeyStatuses([]);
    setCurrentKeyIndex(0);
    geminiService.current = null;
  };

  // Render Helpers
  const renderStepIndicator = () => {
    const steps = [
      "API 金鑰", "題目", "參考文獻", "範例", "分析", "初稿"
    ];
    return (
      <div className="flex overflow-x-auto pb-4 mb-8 border-b border-slate-200 no-scrollbar">
        {steps.map((label, idx) => {
          const isActive = idx === step;
          const isCompleted = idx < step;
          return (
            <div key={idx} className="flex items-center min-w-max mr-4 md:mr-8 last:mr-0">
              <div className={`
                flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold mr-2
                ${isActive ? 'bg-indigo-600 text-white' : isCompleted ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'}
              `}>
                {isCompleted ? '✓' : idx + 1}
              </div>
              <span className={`text-sm font-medium ${isActive ? 'text-indigo-900' : 'text-slate-500'}`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Layout title={step === Step.API_KEYS ? '設定' : '文獻探討助手'}>
      {step !== Step.API_KEYS && renderStepIndicator()}

      {/* API Key 狀態顯示 */}
      {step !== Step.API_KEYS && keyStatuses.length > 0 && (
        <div className="space-y-4">
          <ApiKeyStatus keyStatuses={keyStatuses} currentIndex={currentKeyIndex} />
          <div className="flex justify-end">
            <button
              onClick={resetToHome}
              className="text-sm text-slate-600 hover:text-indigo-600 flex items-center gap-1 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              回到首頁
            </button>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 0: API Keys */}
        {step === Step.API_KEYS && (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-slate-900">設定 API 金鑰</h2>
              <p className="text-slate-500">請提供多組 Gemini API 金鑰以確保服務不中斷 (自動切換以應對 429/流量限制)。</p>
            </div>

            <div className="space-y-3">
              {apiKeys.map((key, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <span className="text-xs text-slate-400 w-4 text-right shrink-0">{index + 1}</span>
                  <input
                    type="password"
                    placeholder={`API 金鑰 #${index + 1}`}
                    value={key}
                    onChange={(e) => handleApiKeyChange(index, e.target.value)}
                    className="flex-1 rounded-lg border-slate-300 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                  />
                  {/* 刪除按鈕 */}
                  <button
                    onClick={() => removeApiKeyField(index)}
                    disabled={apiKeys.length <= 1}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="移除此金鑰"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                  {/* 新增按鈕（只在最後一欄顯示）*/}
                  {index === apiKeys.length - 1 && (
                    <button
                      onClick={addApiKeyField}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="新增一組金鑰"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              金鑰已加密儲存於本機，重新整理後自動載入，不會上傳至任何伺服器。
            </p>

            <Button onClick={initializeService} className="w-full">
              開始使用
            </Button>
          </div>
        )}

        {/* Step 1: Thesis Info */}
        {step === Step.THESIS_INFO && (
          <div className="space-y-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800">研究細節</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">論文題目</label>
                <input
                  type="text"
                  value={thesisInfo.title}
                  onChange={(e) => setThesisInfo({ ...thesisInfo, title: e.target.value })}
                  placeholder="例如：人工智慧對都市規劃的影響"
                  className="w-full rounded-lg border-slate-300 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">研究重點 / 目標</label>
                <textarea
                  value={thesisInfo.topic}
                  onChange={(e) => setThesisInfo({ ...thesisInfo, topic: e.target.value })}
                  placeholder="您具體想要證明什麼或探索什麼？"
                  className="w-full h-32 rounded-lg border-slate-300 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">當前撰寫的文獻探討部分 (選填)</label>
                <input
                  type="text"
                  value={thesisInfo.currentSection || ''}
                  onChange={(e) => setThesisInfo({ ...thesisInfo, currentSection: e.target.value })}
                  placeholder="例如：理論基礎、相關研究、研究方法等"
                  className="w-full rounded-lg border-slate-300 border px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">指定後，AI 將聚焦於此部分的文獻分析與撰寫</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => setStep(Step.UPLOAD_REFS)}
                disabled={!thesisInfo.title || !thesisInfo.topic}
              >
                下一步：上傳參考文獻
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Upload References */}
        {step === Step.UPLOAD_REFS && (
          <div className="space-y-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800">上傳英文參考文獻</h2>
            <FileUpload
              label="選擇 PDF 檔案 (最多 5 個)"
              description="英文學術論文 (限 PDF)"
              maxFiles={5}
              onFilesSelected={(files) => {
                setReferences(files);
              }}
            />
            {references.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">已選檔案：</p>
                <ul className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                  {references.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 py-1">
                      <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {f.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep(Step.THESIS_INFO)}>上一步</Button>
              <Button
                onClick={() => setStep(Step.UPLOAD_STYLE)}
                disabled={references.length === 0}
              >
                下一步：上傳範例
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Upload Style Example */}
        {step === Step.UPLOAD_STYLE && (
          <div className="space-y-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800">上傳學長姐範例 (選填)</h2>
            <p className="text-sm text-slate-500">
              上傳一份「學長姐的範例」或是您想模仿其語氣/結構的高品質論文。可指定特定頁碼範圍。
            </p>
            <FileUpload
              label="選擇範例 PDF"
              description="單一 PDF 檔案"
              maxFiles={1}
              showPageRange={true}
              onFilesSelected={(files) => {
                if (files.length > 0) setSeniorExample(files[0]);
              }}
            />
            {seniorExample && (
              <div className="text-sm text-indigo-700 bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                已選範例： <span className="font-semibold">{seniorExample.name}</span>
                {seniorExample.pageRange && (
                  <span className="ml-2 text-indigo-600">(頁碼: {seniorExample.pageRange})</span>
                )}
              </div>
            )}

            {/* 進度條 */}
            {isLoading && progress.total > 0 && (
              <ProgressBar
                current={progress.current}
                total={progress.total}
                label="分析參考文獻"
                currentItem={progress.item}
              />
            )}

            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep(Step.UPLOAD_REFS)}>上一步</Button>
              <Button
                onClick={handleAnalysis}
                isLoading={isLoading}
                disabled={isLoading}
              >
                開始分析
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Analysis Result */}
        {step === Step.ANALYSIS && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">文獻分析結果</h2>
              <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-700 rounded-full">分析完成</span>
            </div>

            <MarkdownView content={analysisResult} />

            <div className="sticky bottom-4 flex justify-end gap-3 bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-slate-200 shadow-lg">
              <Button variant="secondary" onClick={() => setStep(Step.UPLOAD_STYLE)}>上一步</Button>
              <Button onClick={handleDrafting} isLoading={isLoading}>
                生成文獻探討初稿
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Draft Result */}
        {step === Step.DRAFT && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">文獻探討初稿</h2>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => {
                  navigator.clipboard.writeText(draftResult);
                  alert("已複製到剪貼簿！");
                }}>
                  複製 Markdown
                </Button>
                <Button variant="secondary" onClick={reset}>重新分析</Button>
                <Button variant="secondary" onClick={resetToHome}>回到首頁</Button>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-sm text-yellow-800">
              <strong>學術倫理提醒：</strong> 這是 AI 生成的初稿。在用於您的論文之前，請務必核對原始 PDF 中的引用和內容，確保無誤。
            </div>

            <MarkdownView content={draftResult} />
          </div>
        )}
      </div>
    </Layout>
  );
}
