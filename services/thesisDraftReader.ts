/**
 * thesisDraftReader.ts
 *
 * 在瀏覽器端讀取使用者的論文草稿：
 * - .docx / .doc → 使用 mammoth.js 轉為純文字
 * - .pdf          → 使用 FileReader 讀為 base64，再用 Gemini 解析
 *                   （此處僅提供文字萃取，PDF 方案回傳 base64 以供 geminiService 使用）
 */

import mammoth from 'mammoth';

export interface ThesisDraftData {
    fileName: string;
    /** 純文字內容（.docx 解析後或 PDF 暫以提示取代） */
    text: string;
    /** 原始 PDF base64（僅 PDF 有值，.docx 為 null） */
    pdfBase64: string | null;
    /** 字數（給使用者確認用） */
    charCount: number;
}

/**
 * 從 File 物件萃取論文文字內容
 * 支援 .docx / .doc（mammoth）和 .pdf（FileReader base64）
 */
export async function extractThesisDraft(file: File): Promise<ThesisDraftData> {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'docx' || ext === 'doc') {
        // 用 mammoth 解析 Word 檔
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = result.value.trim();
        return {
            fileName: file.name,
            text,
            pdfBase64: null,
            charCount: text.length,
        };
    }

    if (ext === 'pdf') {
        // PDF 轉 base64 提供給 Gemini inline data
        const base64 = await fileToBase64(file);
        return {
            fileName: file.name,
            text: '', // PDF 由 Gemini 直接讀取，不需前端解析文字
            pdfBase64: base64,
            charCount: 0,
        };
    }

    throw new Error(`不支援的檔案格式：${ext}。請上傳 .docx 或 .pdf 檔案。`);
}

/** 將 File 轉為 base64 字串（不含 data URL 前綴） */
function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            // 移除 "data:...;base64," 前綴
            resolve(dataUrl.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
