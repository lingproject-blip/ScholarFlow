import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownViewProps {
  content: string;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content }) => {
  return (
    <div className="prose prose-indigo max-w-none prose-headings:font-semibold prose-a:text-indigo-600 prose-blockquote:border-indigo-500 bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
};
