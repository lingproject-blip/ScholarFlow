import { GoogleGenerativeAI } from "@google/generative-ai";
import { FileData } from "../types";
import { ApiKeyManager } from "./ApiKeyManager";

// Helper to wait
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface ProgressCallback {
  (current: number, total: number, currentItem: string): void;
}

export class GeminiService {
  private keyManager: ApiKeyManager;

  constructor(apiKeys: string[]) {
    this.keyManager = new ApiKeyManager(apiKeys);
  }

  /**
   * 取得 API key 管理器 (用於 UI 訂閱狀態更新)
   */
  getKeyManager(): ApiKeyManager {
    return this.keyManager;
  }

  /**
   * 執行 API 請求，自動處理重試和 key 切換
   */
  private async executeWithRetry<T>(
    operation: (genAI: GoogleGenerativeAI) => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let attempts = 0;

    while (attempts < maxRetries) {
      if (!this.keyManager.hasAvailableKey()) {
        throw new Error("所有 API 金鑰皆已耗盡。請明天再試或新增更多金鑰。");
      }

      try {
        this.keyManager.markAsActive();
        const currentKey = this.keyManager.getCurrentKey();
        const genAI = new GoogleGenerativeAI(currentKey);

        const result = await operation(genAI);

        this.keyManager.markSuccess();
        return result;
      } catch (error: any) {
        console.warn(`請求失敗 (嘗試 ${attempts + 1}/${maxRetries})`, error);

        // 檢查錯誤類型
        const errorMessage = error?.message || JSON.stringify(error);
        const status = error?.status || error?.response?.status;

        // 429 = Rate Limit, 503 = Service Unavailable
        if (status === 429 || errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
          console.log("流量限制錯誤，切換 API key...");
          const switched = this.keyManager.markExhaustedAndRotate();
          if (!switched) {
            throw new Error(`所有 API 金鑰皆無法使用 (或遭到流量限制)。\n伺服器回應: ${errorMessage}\n請檢查 API Key 是否正確或配額已滿。`);
          }
          await delay(2000); // 等待 2 秒後重試
        } else if (status === 404 || errorMessage.includes('404') || errorMessage.includes('NOT_FOUND')) {
          // 404 錯誤通常是 model 名稱錯誤或 API key 無效
          this.keyManager.markError('API key 無效或 model 不存在');
          throw new Error(`API 錯誤: 找不到請求的資源。請檢查 API key 是否有效。詳細: ${errorMessage}`);
        } else {
          // 其他錯誤
          this.keyManager.markError(errorMessage.substring(0, 50));
          throw error;
        }
      }
      attempts++;
    }

    throw new Error("請求失敗次數過多。");
  }

  /**
   * 分析參考文獻 (逐頁處理以避免流量限制)
   */
  async analyzeReferences(
    thesisTitle: string,
    researchTopic: string,
    currentSection: string | undefined,
    references: FileData[],
    onProgress?: ProgressCallback,
    thesisDraftText?: string,
    thesisDraftPdfBase64?: string
  ): Promise<string> {
    const results: string[] = [];
    let processedCount = 0;
    const totalFiles = references.length;

    for (let i = 0; i < references.length; i++) {
      const ref = references[i];
      processedCount++;

      if (onProgress) {
        onProgress(processedCount, totalFiles, `${ref.name}`);
      }

      const result = await this.executeWithRetry(async (genAI) => {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const sectionContext = currentSection
          ? `\n**重要提醒**: 我目前正在撰寫「${currentSection}」這個小節的文獻探討。請特別聚焦於與此小節相關的內容。`
          : '';

        // 論文草稿上下文（若有提供）
        const draftContext = thesisDraftText
          ? `\n**我目前的論文草稿（已完成部分）**：\n請仔細閱讀以下我已寫好的論文內容，了解我的寫作進度、風格與已涵蓋的論點，分析文獻時請避免重複已有內容，並聚焦於能補充和延伸現有論述的發現。\n\n---\n${thesisDraftText.substring(0, 8000)}\n---`
          : '';

        const prompt = `
你是一位專業的學術研究助理。

我的論文題目：「${thesisTitle}」
我的研究主題/重點：「${researchTopic}」${sectionContext}${draftContext}

任務：
1. 分析附檔中的英文學術論文（文獻編號 #${i + 1}：${ref.name}）。
2. 找出能直接支持我的研究主題的關鍵發現、方法論、理論或論點。
3. 不要只是總結論文。請提取具體的點來證明我的研究的重要性、可行性，或是有理論依據。
4. 列出與我的主題一致的「關鍵引用內容」。
5. **所有輸出結果必須使用繁體中文（Traditional Chinese）撰寫。**
6. **重要：在每個論點或發現後，請明確標注「[來源：${ref.name}]」，以便後續引用追蹤。**
7. 以清晰的 Markdown 格式輸出，包含標題。

請以以下格式輸出：
## 📄 ${ref.name}

### 核心發現
[列出關鍵發現，每個發現後標注 [來源：${ref.name}]]

### 可引用論點
[列出可直接引用的論點，每個論點後標注 [來源：${ref.name}]]

### 與研究主題的關聯
[說明如何支持我的研究]
        `;

        const contentParts: any[] = [];

        // 若有 PDF 格式的論文草稿，先加入
        if (thesisDraftPdfBase64) {
          contentParts.push({
            inlineData: { mimeType: 'application/pdf', data: thesisDraftPdfBase64 },
          });
        }

        // 加入參考文獻 PDF
        contentParts.push(
          { inlineData: { mimeType: ref.type, data: ref.base64 } },
          { text: prompt }
        );

        const result = await model.generateContent(contentParts);

        const response = await result.response;
        return response.text();
      });

      results.push(result);

      // 在處理下一個檔案前等待，避免觸發流量限制
      if (i < references.length - 1) {
        await delay(2000); // 2 秒延遲
      }
    }

    // 合併所有結果
    const combinedResult = `# 文獻分析結果\n\n${results.join('\n\n---\n\n')}`;
    return combinedResult;
  }

  /**
   * 生成文獻探討初稿
   */
  async generateDraft(
    thesisTitle: string,
    researchTopic: string,
    currentSection: string | undefined,
    analysisText: string,
    seniorExample: FileData | null,
    thesisDraftText?: string,
    thesisDraftPdfBase64?: string
  ): Promise<string> {
    return this.executeWithRetry(async (genAI) => {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const parts: any[] = [];

      // 若有 PDF 格式的論文草稿，先加入
      if (thesisDraftPdfBase64) {
        parts.push({
          inlineData: { mimeType: 'application/pdf', data: thesisDraftPdfBase64 },
        });
      }

      // Add the Senior Example if it exists
      if (seniorExample) {
        parts.push({
          inlineData: {
            mimeType: seniorExample.type,
            data: seniorExample.base64,
          },
        });
      }

      const sectionContext = currentSection
        ? `\n**重要提醒**: 我目前正在撰寫「${currentSection}」這個小節的文獻探討。請將撰寫重點放在這個部分，確保內容與此小節高度相關。`
        : '';

      // 論文草稿上下文（若有提供）
      const draftContext = thesisDraftText
        ? `\n\n**【重要】我目前已完成的論文草稿**：\n以下是我已寫好的論文內容。請仔細閱讀，充分理解我的寫作風格、用詞習慣、論文結構，以及已涵蓋的論點。\n在撰寫新的文獻探討時，你必須：\n1. 延續相同的寫作風格與語氣\n2. 避免重複已在草稿中提及的論點\n3. 確保新內容與既有章節自然銜接\n\n---草稿開始---\n${thesisDraftText.substring(0, 10000)}\n---草稿結束---`
        : '';

      const prompt = `
你是一位遵循嚴格學術倫理的專業學術寫作者。

背景資訊：
- 論文題目：「${thesisTitle}」
- 研究主題：「${researchTopic}」${sectionContext}${draftContext}
- 文獻分析結果： 
${analysisText}

${seniorExample ? "附件中有一個檔案是「學長姐的文獻探討範例」。請僅參考其風格、結構、語氣和流暢度。切勿抄襲其內容。" : "沒有提供風格範例，請使用標準的高品質學術散文風格。"}

任務：
為我的論文撰寫「文獻探討（Literature Review）」章節的初稿。

要求：
1. **整合（Synthesize）** 上述分析結果中的發現。不要只是條列摘要。將不同論文的觀點串連起來，為我的研究主題建立論證。
2. **引用標注：** **這是最重要的要求！** 在撰寫每個論點、發現或引用時，必須在該句子或段落後立即標注來源文獻。格式為：「[來源：文獻檔名]」。例如：「研究顯示人工智慧可以提升都市規劃效率 [來源：AI_Urban_Planning.pdf]。」
3. **風格：** 模仿附檔範例的學術語氣和結構（如果有提供）。
4. **倫理：** 嚴禁捏造引用。只能使用分析部分提供的資訊。嚴禁抄襲範例的文字。
5. **結構：** 使用有邏輯的流程（例如：主題式或方法論式）。
6. **語言：** **整篇文章必須使用繁體中文（Traditional Chinese）撰寫。**
7. 以清晰的 Markdown 格式輸出。

**範例格式：**
近年來，人工智慧技術在都市規劃領域展現出巨大潛力 [來源：AI_Urban_Planning.pdf]。機器學習演算法能夠分析大量都市數據，協助規劃者做出更精準的決策 [來源：Machine_Learning_Cities.pdf]。
      `;

      parts.push({ text: prompt });

      const result = await model.generateContent(parts);
      const response = await result.response;
      return response.text();
    });
  }
}
