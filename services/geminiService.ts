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
## 角色設定
你是一位資深的學術研究助理，同時也是一位頂尖的英中翻譯專家。你的任務是閱讀英文學術論文，並將關鍵內容以流暢、精準的繁體中文（台灣學術用語）呈現。

## 我的論文資訊
- 論文題目：「${thesisTitle}」
- 研究主題/重點：「${researchTopic}」${sectionContext}${draftContext}

## 翻譯原則（Translation Principles）
在將英文內容轉換為繁體中文時，你必須嚴格遵守以下四項原則：

**原則一：語意保真，破除直譯**
深入理解原文的底層語意、語氣與文化脈絡，尋找最自然、最貼切的中文表達方式，絕不進行僵硬的逐字翻譯。

**原則二：在地化精準度**
所有翻譯必須嚴格遵循台灣的詞彙、用語與語境規範，主動過濾香港或中國大陸慣用語。例如：「taxi」應譯為「計程車」，而非「的士」或「打的」。

**原則三：語氣與文化細膩度**
分析原文的正式程度與情感語氣，選用具有適當分量與內涵的中文字詞和句式。例如：翻譯「love」時，應根據上下文判斷應使用深沉的「愛」或較輕的「喜歡」。

**原則四：格式規範**
- 標點符號：使用全形標點符號（，。？！「」）。
- 中文字元之間不留空格。
- 中文字元與英文字母或數字之間插入一個半形空格（例如：研究結果顯示 AI 的介入效果）。

## 分析任務
請依序完成以下任務：
1. 分析附檔中的英文學術論文（文獻編號 #${i + 1}：${ref.name}）。
2. 依照上述翻譯原則，找出並以流暢繁體中文呈現能直接支持我的研究主題的關鍵發現、方法論、理論或論點。
3. 不要只是總結論文——請提取具體的論點，以證明我的研究的重要性、可行性或理論依據。
4. 列出與我的主題一致的「可直接引用論點」。
5. **所有輸出結果必須使用繁體中文（台灣學術用語）撰寫。**
6. **在每個論點或發現後，請明確標注「[來源：${ref.name}]」，以便後續引用追蹤。**
7. 以清晰的 Markdown 格式輸出，包含標題。

## 輸出格式
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
## 角色設定
你現在是一位專業的學術研究者，擅長撰寫教育、社會科學領域的論文文獻探討。你的任務是以極度客觀、嚴謹、具備學術權威感的語氣，完成一篇約 3000 字的繁體中文學術文獻探討（Traditional Chinese，台灣學術用語）。

## 背景資訊
- 論文題目：「${thesisTitle}」
- 研究主題：「${researchTopic}」${sectionContext}${draftContext}
- 文獻分析結果：
${analysisText}

${seniorExample ? "附件中有一個檔案是「學長姐的文獻探討範例」。請僅參考其風格、結構、語氣和流暢度，切勿抄襲其內容。" : "沒有提供風格範例，請使用標準的高品質學術散文風格。"}

## 撰寫結構要求（請依序完成以下五個部分）

### 第一部分：痛點起手
- 先描述「${researchTopic}」此一主題在台灣當前教育現場所面臨的核心困境與挑戰。
- 點出教師端與學生端雙向的困境，形塑出問題意識，讓讀者感受到研究的迫切性。

### 第二部分：政策掛鉤
- 緊接著提及台灣現行教育政策（例如：十二年國民基本教育課程綱要、核心素養框架）對此主題的具體期待與重要性。
- 說明在政策脈絡下，此議題為何不容忽視，彰顯研究的時代意義。

### 第三部分：多維度定義
- 針對研究主題的核心概念，引用 **2 至 3 組不同學者的定義**進行對比分析。
- 每個定義後須以「（姓名，年份）」格式標注引用來源。
- 在段末必須使用「**綜上所述**」或「**歸納而言**」作為段落開頭，給出對該核心概念的**綜合定義**。

### 第四部分：實證回顧
- 列舉至少 **3 至 4 個具體研究案例**，優先選用 2020 年後的近期研究。
- 每個案例須包含：研究者姓名、年份、研究科目或場域、主要發現與結論。
- 以「（姓名，年份）」格式標注引用。
- 這些案例需共同形成論證，證明「${researchTopic}」相關方法或能力的有效性。

### 第五部分：研究收束
- 在上述背景的基礎上，說明本研究為何有必要導入特定的工具或方法進行探討。
- 點出現有研究的不足之處（研究缺口），以此確立本研究的學術定位與貢獻。

## 寫作風格與語調要求
- **語氣：** 極度客觀、嚴謹、具備學術權威感，避免口語化表達。
- **引用格式：** 嚴格遵守「（姓名，年份）」格式，並在文末無需附上參考書目。
- **引用來源標注：** 在使用文獻分析結果中的資料時，同時附上「[來源：文獻檔名]」以供後續核查。
- **詞彙偏好：** 多使用「心智歷程」、「先備知識」、「綜整」、「介入」、「實施」、「建構」、「脈絡」、「探討」、「論證」、「有效性」等專業學術詞彙。
- **邏輯銜接：** 段落與段落之間必須有強烈的**因果或補充關係**，避免瑣碎的條列陳述，以散文式學術論述呈現。
- **嚴禁捏造：** 只能使用上述文獻分析結果中實際存在的資訊，嚴禁捏造任何研究數據或學者姓名。

## 輸出語言
繁體中文（台灣學術用語），以清晰的 Markdown 格式輸出，使用 ##、### 標題區分各部分。
      `;

      parts.push({ text: prompt });

      const result = await model.generateContent(parts);
      const response = await result.response;
      return response.text();
    });
  }
}
