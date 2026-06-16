'use client';

import React, { useState } from 'react';
import { renderNoteContent } from '@/lib/markdown';
import { Printer, ArrowLeft, Filter, BookOpen, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface Problem {
  problemId: string;
  title: string;
  lcUrl: string;
  note: string;
  confidence: number;
  intervalDays: number;
  nextDue: Date | string;
}

interface CheatSheetClientProps {
  initialProblems: Problem[];
}

export default function CheatSheetClient({ initialProblems }: CheatSheetClientProps) {
  const [filterMode, setFilterMode] = useState<'all' | 'weakness'>('all');

  const displayedProblems = initialProblems.filter((p) => {
    if (filterMode === 'weakness') {
      return p.confidence < 4; // Only show problems where user struggles
    }
    return true;
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Interactive Controls Bar - Hidden during Print */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <Link 
            href="/settings" 
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium mb-1.5"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Settings
          </Link>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Pre-Interview Cheat Sheet
          </h2>
          <p className="text-xs text-muted-foreground">
            Print or save your personal notes queue as a PDF for quick review before calls.
          </p>
        </div>

        <div className="flex items-center gap-3 self-stretch sm:self-auto">
          {/* Filter Toggles */}
          <div className="inline-flex rounded-xl bg-card border border-border p-1 shadow-sm text-xs font-semibold">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({initialProblems.length})
            </button>
            <button
              onClick={() => setFilterMode('weakness')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'weakness'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              Weaknesses ({initialProblems.filter(p => p.confidence < 4).length})
            </button>
          </div>

          {/* Print Action */}
          <button
            onClick={handlePrint}
            disabled={displayedProblems.length === 0}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-95 shadow-md shadow-primary/10 transition-all text-sm cursor-pointer disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Print / PDF
          </button>
        </div>
      </div>

      {displayedProblems.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground print:hidden">
          No problems matching the filter. Log more problems or improve review counts to build your cheat sheet!
        </div>
      ) : (
        /* Printable Content Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4 print:text-black">
          {displayedProblems.map((problem) => (
            <div 
              key={problem.problemId} 
              className="bg-card border border-border rounded-2xl p-5 space-y-3 shadow-sm break-inside-avoid print:bg-white print:border-zinc-300 print:shadow-none print:p-4"
            >
              <div className="flex justify-between items-start gap-4">
                <h3 className="font-extrabold text-base text-foreground print:text-black">
                  <a 
                    href={problem.lcUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:underline flex items-center gap-1.5"
                  >
                    {problem.title}
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground print:hidden" />
                  </a>
                </h3>
                
                {/* Confidence Badge */}
                <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 print:bg-zinc-100 print:text-zinc-800 print:border-zinc-300">
                  Confidence: {problem.confidence}/5
                </span>
              </div>

              {/* Note Content */}
              <div className="text-xs leading-relaxed text-foreground/90 print:text-zinc-800">
                {renderNoteContent(problem.note)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CSS overrides specifically for printing */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .bg-card {
            background: white !important;
            border-color: #d4d4d8 !important;
          }
          .text-foreground {
            color: black !important;
          }
          .text-muted-foreground {
            color: #71717a !important;
          }
          code, pre {
            background-color: #f4f4f5 !important;
            color: black !important;
            border-color: #e4e4e7 !important;
          }
        }
      `}</style>
    </div>
  );
}
