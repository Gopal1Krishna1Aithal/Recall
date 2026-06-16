import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  code: string;
}

export function CopyButton({ code }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-100 border border-zinc-700/60 hover:bg-zinc-700/80 transition-all cursor-pointer flex items-center gap-1 text-[10px] font-medium"
      title="Copy code"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-green-500" />
          <span>Copied!</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

export function renderNoteContent(note: string) {
  if (!note) return null;

  // Unescape existing HTML entities
  const unescaped = unescapeHtml(note);

  // Split content by code blocks: ```[lang]\n[code]\n```
  const parts = unescaped.split(/(```[\s\S]*?```)/g);

  return parts.map((part, index) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      // It's a code block
      const lines = part.slice(3, -3).trim().split('\n');
      let language = 'code';
      let codeContent = part.slice(3, -3).trim();

      // Check if the first line specifies a language
      const firstLine = lines[0].trim();
      const hasLang = /^[a-zA-Z0-9+#]+$/.test(firstLine);
      if (hasLang && lines.length > 1) {
        language = firstLine;
        codeContent = lines.slice(1).join('\n').trim();
      }

      return (
        <div key={index} className="my-3 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 overflow-hidden font-mono text-xs shadow-md">
          {/* Header Bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800/60 text-[10px] font-semibold tracking-wider uppercase text-zinc-400">
            <span>{language}</span>
            <CopyButton code={codeContent} />
          </div>
          {/* Code */}
          <pre className="p-4 overflow-x-auto leading-relaxed whitespace-pre font-mono">
            <code>{codeContent}</code>
          </pre>
        </div>
      );
    }

    // It's normal text, parse inline formatting line-by-line or inline regex
    // 1. Double newlines to paragraphs
    const paragraphs = part.split(/\n{2,}/g);

    return (
      <div key={index} className="space-y-2">
        {paragraphs.map((pText, pIdx) => {
          const lines = pText.split('\n');

          return (
            <div key={pIdx} className="leading-relaxed space-y-1">
              {lines.map((line, lIdx) => {
                const isList = line.trim().startsWith('- ') || line.trim().startsWith('* ');
                const content = isList ? line.trim().slice(2) : line;

                // Simple parser helper for inline tags: `code` and **bold**
                const parsedElements = parseInlineTags(content);

                if (isList) {
                  return (
                    <span key={lIdx} className="flex items-start gap-2 pl-4 py-0.5 text-foreground/90">
                      <span className="text-primary select-none mt-2 shrink-0 block w-1.5 h-1.5 rounded-full bg-primary" />
                      <span className="flex-1">{parsedElements}</span>
                    </span>
                  );
                }

                return (
                  <span key={lIdx} className="inline-block w-full text-foreground/90">
                    {parsedElements}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  });
}

function parseInlineTags(text: string) {
  // Regex to match inline code `code` and bold **bold**
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-bold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={index}
          className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted border border-border/80 text-amber-500 dark:text-amber-400 font-semibold"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export function unescapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

