'use client';

import React, { useState, useEffect } from 'react';
import { extractTitleFromUrl, logProblemAction, submitReviewAction } from '@/app/actions/problemActions';
import { 
  Sparkles, 
  ExternalLink, 
  Check, 
  ChevronDown, 
  Plus, 
  Loader, 
  Bookmark, 
  CheckCircle2, 
  Frown, 
  AlertCircle 
} from 'lucide-react';

interface Problem {
  problemId: string;
  title: string;
  lcUrl: string;
  note: string;
  confidence: number;
  intervalDays: number;
  nextDue: Date | string;
}

interface TodayQueueProps {
  initialQueue: Problem[];
}

export default function TodayQueue({ initialQueue }: TodayQueueProps) {
  const [queue, setQueue] = useState<Problem[]>(initialQueue);
  const [fadingId, setFadingId] = useState<string | null>(null);

  // Quick-Add Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Auto-extract title when URL changes
  useEffect(() => {
    const autoExtract = async () => {
      if (url.startsWith('http') && url.includes('leetcode.com/problems/')) {
        setExtracting(true);
        const extracted = await extractTitleFromUrl(url);
        setExtracting(false);
        if (extracted) {
          setTitle(extracted);
        }
      }
    };
    autoExtract();
  }, [url]);

  const handleAddProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    setFormSuccess(null);

    const res = await logProblemAction({
      lcUrl: url,
      title: title,
      note: note,
    });

    setLoading(false);

    if (res.success) {
      setFormSuccess(`"${title}" logged successfully! Scheduled for tomorrow.`);
      setUrl('');
      setTitle('');
      setNote('');
      // Auto-collapse form after short delay
      setTimeout(() => {
        setIsFormOpen(false);
        setFormSuccess(null);
      }, 3000);
    } else {
      setFormError(res.error || 'Failed to log problem.');
    }
  };

  const handleRate = async (problemId: string, rating: 'Blank' | 'Shaky' | 'GotIt') => {
    // 1. Trigger fade-out animation locally
    setFadingId(problemId);

    // 2. Perform backend action asynchronously
    const res = await submitReviewAction(problemId, rating);

    // 3. Complete animation transition
    setTimeout(() => {
      if (res.success) {
        setQueue((prev) => prev.filter((p) => p.problemId !== problemId));
      } else {
        alert(res.error || 'Error saving review. Please try again.');
      }
      setFadingId(null);
    }, 200); // sync with tailwind duration-200
  };

  return (
    <div className="w-full space-y-8">
      {/* 1. PERSISTENT INLINE ADD FORM/BAR */}
      <div className="bg-card border border-border shadow-xl rounded-2xl overflow-hidden backdrop-blur-md">
        <button
          onClick={() => {
            setIsFormOpen(!isFormOpen);
            setFormError(null);
            setFormSuccess(null);
          }}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Log a Solved Problem</h3>
              <p className="text-xs text-muted-foreground">Add LeetCode URL, notes, and key insights.</p>
            </div>
          </div>
          <ChevronDown
            className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${
              isFormOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isFormOpen && (
          <form onSubmit={handleAddProblem} className="px-6 pb-6 pt-2 border-t border-border space-y-4 animate-fade-in">
            {formError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium border border-destructive/20">
                {formError}
              </div>
            )}

            {formSuccess && (
              <div className="p-3 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 text-sm font-medium border border-green-500/20 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* LeetCode URL */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  LeetCode URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://leetcode.com/problems/two-sum/"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder-muted-foreground/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>

              {/* Title (Auto or Manual) */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Problem Title
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder={extracting ? 'Extracting...' : 'Enter Title'}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={extracting}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder-muted-foreground/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-75"
                  />
                  {extracting && (
                    <div className="absolute right-3 top-2.5">
                      <Loader className="h-4 w-4 animate-spin text-primary" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Note Textarea */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Key Insights (Spaced Repetition Note)
                </label>
                <span className={`text-xs ${note.length > 750 ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                  {note.length} / 800
                </span>
              </div>
              <textarea
                required
                maxLength={800}
                placeholder="What was the key insight? e.g., 'Use two-pointers from both ends after sorting. Remember to handle duplicate values by skipping...'"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder-muted-foreground/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-y"
              />
            </div>

            {/* Submit */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading || extracting || !url || !title || !note}
                className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-95 shadow-lg shadow-primary/10 transition-all flex items-center gap-1.5 text-sm cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? <Loader className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Log Problem
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 2. DAILY REVISION QUEUE */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-primary" />
            Daily Revision Queue
          </h2>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary">
            {queue.length} Due Today
          </span>
        </div>

        {queue.length === 0 ? (
          /* Empty State */
          <div className="bg-card border border-border rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-sm">
            <div className="p-4 rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Inbox Zero!</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              All caught up! Nothing due for review today. Add today's LeetCode problem above to build the habit.
            </p>
          </div>
        ) : (
          /* Queue Cards */
          <div className="space-y-4">
            {queue.map((problem) => {
              const isFading = fadingId === problem.problemId;

              return (
                <div
                  key={problem.problemId}
                  className={`bg-card border border-border shadow-md rounded-2xl p-6 transition-all duration-200 transform ${
                    isFading ? 'opacity-0 scale-95 pointer-events-none translate-x-4' : 'opacity-100 scale-100'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex justify-between items-start gap-4 mb-3">
                    <h3 className="font-extrabold text-lg text-foreground hover:text-primary transition-colors">
                      <a
                        href={problem.lcUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 hover:underline"
                      >
                        {problem.title}
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </a>
                    </h3>
                    <div className="flex gap-1 shrink-0">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-2.5 h-2.5 rounded-full ${
                            i < problem.confidence
                              ? 'bg-amber-400 dark:bg-amber-500'
                              : 'bg-muted border border-border'
                          }`}
                          title={`Confidence: ${problem.confidence}/5`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Card Note (escaped notes rendered safely) */}
                  <div className="bg-muted/50 border border-border/40 rounded-xl p-4 mb-6 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                    {/* Render plain text since DB is pre-sanitized */}
                    {problem.note}
                  </div>

                  {/* Card Footer Rating Buttons */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-t border-border/40 pt-4">
                    <span className="text-xs text-muted-foreground">
                      Current interval: <span className="font-semibold">{problem.intervalDays} day{problem.intervalDays > 1 ? 's' : ''}</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRate(problem.problemId, 'Blank')}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-destructive hover:bg-destructive/10 border border-destructive/20 transition-all cursor-pointer"
                      >
                        <Frown className="h-3.5 w-3.5" />
                        Blank (1d)
                      </button>

                      <button
                        onClick={() => handleRate(problem.problemId, 'Shaky')}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-amber-500 hover:bg-amber-500/10 border border-amber-500/20 transition-all cursor-pointer"
                      >
                        <AlertCircle className="h-3.5 w-3.5" />
                        Shaky
                      </button>

                      <button
                        onClick={() => handleRate(problem.problemId, 'GotIt')}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-green-600 dark:text-green-400 hover:bg-green-500/10 border border-green-500/20 transition-all cursor-pointer"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Got It
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
