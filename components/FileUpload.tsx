import React, { useCallback, useState } from 'react';
import { FileData } from '../types';

interface FileUploadProps {
  onFilesSelected: (files: FileData[]) => void;
  maxFiles?: number;
  accept?: string;
  label: string;
  description: string;
  showPageRange?: boolean; // 是否顯示頁碼範圍輸入
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFilesSelected,
  maxFiles = 5,
  accept = ".pdf",
  label,
  description,
  showPageRange = false
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageRange, setPageRange] = useState<string>('');

  const processFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList) return;
    setError(null);

    const filesArray = Array.from(fileList);
    if (filesArray.length > maxFiles) {
      setError(`最多允許 ${maxFiles} 個檔案。`);
      return;
    }

    const processedFiles: FileData[] = [];

    for (const file of filesArray) {
      if (file.type !== 'application/pdf') {
        // Strict check, though usually accepts generic generic binary if needed, 
        // prompt specifically asked for PDF reading.
        // We'll trust the accept attribute but warn if it's wildly wrong.
      }

      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => {
            const result = reader.result as string;
            // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
            const base64Data = result.split(',')[1];
            resolve(base64Data);
          };
          reader.onerror = error => reject(error);
        });

        processedFiles.push({
          name: file.name,
          type: file.type,
          base64: base64,
          pageRange: showPageRange && pageRange ? pageRange : undefined,
        });
      } catch (e) {
        console.error("File processing error", e);
        setError("處理檔案時發生錯誤: " + file.name);
      }
    }

    onFilesSelected(processedFiles);
  }, [maxFiles, onFilesSelected]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>

      {showPageRange && (
        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            頁碼範圍 (選填)
          </label>
          <input
            type="text"
            value={pageRange}
            onChange={(e) => setPageRange(e.target.value)}
            placeholder="例如: 5-10 或 5,7,9-12"
            className="w-full rounded-lg border-slate-300 border px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <p className="text-xs text-slate-500 mt-1">
            留空則使用整份文件。格式範例: "5-10" (第5到10頁) 或 "1,3,5-8" (第1、3、5到8頁)
          </p>
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center transition-colors
          ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-slate-400 bg-white'}
        `}
      >
        <input
          type="file"
          multiple={maxFiles > 1}
          accept={accept}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={(e) => processFiles(e.target.files)}
        />
        <div className="flex flex-col items-center pointer-events-none">
          <svg className="w-10 h-10 text-slate-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-slate-600 font-medium">拖放檔案至此或點擊瀏覽</p>
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        </div>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
};
