'use client';

import React, { useState, useEffect } from 'react';
import { 
  extractTitleFromUrl, 
  logProblemAction, 
  submitReviewAction, 
  getReviewStreakAction,
  fetchRecentLeetcodeSubmissionsAction,
  getAllProblemsAction,
  getWeeklyRevisionSummaryAction
} from '@/app/actions/problemActions';
import { renderNoteContent } from '@/lib/markdown';
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
  AlertCircle,
  Calendar,
  Flame,
  RefreshCw,
  AlertTriangle,
  Clock,
  Timer
} from 'lucide-react';

interface Problem {
  problemId: string;
  title: string;
  lcUrl: string;
  note: string;
  confidence: number;
  intervalDays: number;
  nextDue: Date | string;
  tags?: string | null;
}

interface TodayQueueProps {
  initialQueue: Problem[];
}

export default function TodayQueue({ initialQueue }: TodayQueueProps) {
  const [queue, setQueue] = useState<Problem[]>(initialQueue);
  const [fadingId, setFadingId] = useState<string | null>(null);

  // Streak & progress states
  const [streak, setStreak] = useState<number | null>(null);
  const [initialTotalCount, setInitialTotalCount] = useState(initialQueue.length);
  const [customIntervals, setCustomIntervals] = useState<Record<string, number | null>>({});
  const [failureReasons, setFailureReasons] = useState<Record<string, string>>({});
  const [sketches, setSketches] = useState<Record<string, string>>({});
  const [openSketches, setOpenSketches] = useState<Record<string, boolean>>({});
  const [revealedNotes, setRevealedNotes] = useState<Record<string, boolean>>({});

  // LeetCode sync states
  const [leetcodeUsername, setLeetcodeUsername] = useState<string | null>(null);
  const [recentSubmissions, setRecentSubmissions] = useState<{ title: string; lcUrl: string; timestamp: number }[]>([]);
  const [fetchingSubmissions, setFetchingSubmissions] = useState(false);

  // Zen Mode state
  const [isZenMode, setIsZenMode] = useState(false);
  const [zenTheme, setZenTheme] = useState<'obsidian' | 'terminal' | 'matrix' | 'cyberpunk'>('obsidian');

  // Rehearsal states
  const [isRehearsalMode, setIsRehearsalMode] = useState(false);
  const [rehearsalQueue, setRehearsalQueue] = useState<Problem[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<Record<string, number>>({
    'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0, 'Sun': 0
  });

  // Quick-Add Form state for tags
  const [formTags, setFormTags] = useState('');

  // Timer states
  const [timers, setTimers] = useState<Record<string, number>>({});
  const [timerActive, setTimerActive] = useState<Record<string, boolean>>({});
  const [timerLimits, setTimerLimits] = useState<Record<string, number>>({});

  // Timer tick effect
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prevTimers) => {
        const updated = { ...prevTimers };
        let changed = false;
        
        Object.keys(updated).forEach((id) => {
          if (timerActive[id] && updated[id] > 0) {
            updated[id] = updated[id] - 1;
            changed = true;
          }
        });
        
        return changed ? updated : prevTimers;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [timerActive]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}:${remainder.toString().padStart(2, '0')}`;
  };

  // TTS Audio Note state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  // Trace Grid state
  const [traceGrids, setTraceGrids] = useState<Record<string, { columns: string[]; rows: Record<string, string>[] }>>({});

  // Editor vs Textarea mode selection
  const [sketchModes, setSketchModes] = useState<Record<string, 'text' | 'editor'>>({});
  const [runValidationResults, setRunValidationResults] = useState<Record<string, { success: boolean; message: string } | null>>({});

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const playAudioNote = (problemId: string, title: string, noteText: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (playingAudioId === problemId) {
      window.speechSynthesis.cancel();
      setPlayingAudioId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanNote = noteText.replace(/[`*#_\[\]\-]/g, ' ');
    const utterance = new SpeechSynthesisUtterance(`Problem title: ${title}. Key insights: ${cleanNote}`);
    utterance.onend = () => setPlayingAudioId(null);
    utterance.onerror = () => setPlayingAudioId(null);
    setPlayingAudioId(problemId);
    window.speechSynthesis.speak(utterance);
  };

  const validatePseudocode = (problemId: string, code: string) => {
    if (!code || code.trim().length === 0) {
      setRunValidationResults(prev => ({
        ...prev,
        [problemId]: { success: false, message: 'Please write some code to validate first.' }
      }));
      return;
    }

    const stack: string[] = [];
    const openBraces = ['{', '[', '('];
    const closeBraces = ['}', ']', ')'];
    const matching: Record<string, string> = { '}': '{', ']': '[', ')': '(' };
    
    let isBalanced = true;
    let unmatchedChar = '';
    
    for (let char of code) {
      if (openBraces.includes(char)) {
        stack.push(char);
      } else if (closeBraces.includes(char)) {
        const last = stack.pop();
        if (last !== matching[char]) {
          isBalanced = false;
          unmatchedChar = char;
          break;
        }
      }
    }

    if (stack.length > 0) {
      isBalanced = false;
      unmatchedChar = stack[stack.length - 1];
    }

    if (!isBalanced) {
      setRunValidationResults(prev => ({
        ...prev,
        [problemId]: { 
          success: false, 
          message: `Lint error: Unmatched delimiter found: "${unmatchedChar}". Ensure all brackets are closed.` 
        }
      }));
    } else {
      setRunValidationResults(prev => ({
        ...prev,
        [problemId]: { 
          success: true, 
          message: 'Code analysis check passed! All delimiters are balanced.' 
        }
      }));
    }
  };

  // Re-fetch weekly summary when reviews complete
  useEffect(() => {
    const fetchWeeklySummary = async () => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await getWeeklyRevisionSummaryAction(tz);
      if (res.success && res.summary) {
        setWeeklySummary(res.summary);
      }
    };
    fetchWeeklySummary();
  }, [queue]);

  // Auto-exit Zen Mode if queue becomes empty
  useEffect(() => {
    const activeQueue = isRehearsalMode ? rehearsalQueue : queue;
    if (activeQueue.length === 0 && isZenMode) {
      setIsZenMode(false);
      if (isRehearsalMode) {
        setIsRehearsalMode(false);
        alert("Rehearsal session completed successfully!");
      }
    }
  }, [queue, rehearsalQueue, isZenMode, isRehearsalMode]);

  // Keyboard shortcuts listener
  useEffect(() => {
    const activeQueue = isRehearsalMode ? rehearsalQueue : queue;
    if (!isZenMode || activeQueue.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in a textarea or input
      const activeEl = document.activeElement;
      if (activeEl) {
        const tagName = activeEl.tagName.toUpperCase();
        if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
          return;
        }
      }

      const activeProblem = activeQueue[0];
      if (!activeProblem) return;

      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        setRevealedNotes((prev) => ({ ...prev, [activeProblem.problemId]: true }));
      } else if (e.key === '1') {
        if (revealedNotes[activeProblem.problemId]) {
          handleRate(activeProblem.problemId, 'Blank');
        }
      } else if (e.key === '2') {
        if (revealedNotes[activeProblem.problemId]) {
          handleRate(activeProblem.problemId, 'Shaky');
        }
      } else if (e.key === '3') {
        if (revealedNotes[activeProblem.problemId]) {
          handleRate(activeProblem.problemId, 'GotIt');
        }
      } else if (e.key === 'Escape') {
        setIsZenMode(false);
        if (isRehearsalMode) {
          setIsRehearsalMode(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZenMode, queue, rehearsalQueue, isRehearsalMode, revealedNotes]);

  // Rehearsal Mode Trigger
  const startRehearsalSession = async () => {
    setLoading(true);
    try {
      const allProbs = await getAllProblemsAction();
      if (allProbs && allProbs.length > 0) {
        const formatted = allProbs.map(p => ({
          problemId: p.problemId,
          title: p.title,
          lcUrl: p.lcUrl,
          note: p.note,
          confidence: p.confidence,
          intervalDays: p.intervalDays,
          nextDue: p.nextDue,
          tags: p.tags,
        }));
        setInitialTotalCount(formatted.length);
        setRehearsalQueue(formatted);
        setIsRehearsalMode(true);
        setIsZenMode(true);
      } else {
        alert("You have no logged problems to practice. Log some problems first!");
      }
    } catch (error) {
      console.error(error);
      alert("Failed to load problems for rehearsal.");
    }
    setLoading(false);
  };

  // Local Rehearsal rating handler
  const handleRateRehearsal = (problemId: string) => {
    setFadingId(problemId);
    setTimeout(() => {
      setRehearsalQueue((prev) => prev.filter((p) => p.problemId !== problemId));
      setFadingId(null);
    }, 200);
  };

  // Quick-Add Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const fetchSubmissions = async () => {
    setFetchingSubmissions(true);
    const res = await fetchRecentLeetcodeSubmissionsAction();
    setFetchingSubmissions(false);
    if (res.success) {
      setRecentSubmissions(res.submissions || []);
      setLeetcodeUsername(res.leetcodeUsername || null);
    }
  };

  // Sync initialTotalCount, fetch streak, and fetch submissions
  useEffect(() => {
    setInitialTotalCount(Math.max(initialQueue.length, queue.length));
    
    const fetchInitialData = async () => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const streakRes = await getReviewStreakAction(tz);
      if (streakRes.success && typeof streakRes.streak === 'number') {
        setStreak(streakRes.streak);
      }
      await fetchSubmissions();
    };
    fetchInitialData();
  }, [initialQueue]);

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
      tags: formTags,
    });

    setLoading(false);

    if (res.success) {
      setFormSuccess(`"${title}" logged successfully! Scheduled for tomorrow.`);
      setUrl('');
      setTitle('');
      setNote('');
      setFormTags('');
      // Refresh submissions
      await fetchSubmissions();
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
    if (isRehearsalMode) {
      handleRateRehearsal(problemId);
      return;
    }

    const customDays = customIntervals[problemId] || undefined;
    const failureReason = failureReasons[problemId] || undefined;
    const sketch = sketches[problemId] || undefined;

    // 1. Trigger fade-out animation locally
    setFadingId(problemId);

    // 2. Perform backend action asynchronously
    const res = await submitReviewAction(problemId, rating, undefined, customDays, failureReason, sketch);

    // 3. Complete animation transition
    setTimeout(async () => {
      if (res.success) {
        setQueue((prev) => prev.filter((p) => p.problemId !== problemId));
        
        // Refresh streak calculation
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const streakRes = await getReviewStreakAction(tz);
        if (streakRes.success && typeof streakRes.streak === 'number') {
          setStreak(streakRes.streak);
        }
      } else {
        alert(res.error || 'Error saving review. Please try again.');
      }
      setFadingId(null);
    }, 200); // sync with tailwind duration-200
  };

  const getNextIntervalPreview = (currentInterval: number, rating: 'Blank' | 'Shaky' | 'GotIt') => {
    if (rating === 'Blank') return 1;
    if (rating === 'Shaky') return Math.max(2, Math.round(currentInterval * 1.5));
    return Math.max(4, Math.round(currentInterval * 2.5));
  };

  const completedCount = isRehearsalMode 
    ? initialTotalCount - rehearsalQueue.length
    : initialTotalCount - queue.length;

  const progressPercent = initialTotalCount > 0 ? (completedCount / initialTotalCount) * 100 : 0;

  // Render Zen Focus Mode Overlay (Timebox + Skins themes)
  if (isZenMode && (isRehearsalMode ? rehearsalQueue.length > 0 : queue.length > 0)) {
    const activeProblem = isRehearsalMode ? rehearsalQueue[0] : queue[0];
    const currentCustom = customIntervals[activeProblem.problemId] || null;
    const isExpired = timers[activeProblem.problemId] === 0;

    // Skin Styles bindings
    let themeBgClass = 'bg-background/95 backdrop-blur-md text-foreground';
    let themeCardClass = 'bg-card border-border shadow-2xl';
    let themeInputClass = 'bg-background border border-border text-foreground';
    let themeTextClass = 'text-foreground';
    let themeAccentClass = 'text-primary';
    let themeBadgeClass = 'bg-primary/10 text-primary border border-primary/20';

    if (zenTheme === 'terminal') {
      themeBgClass = 'bg-black text-[#ffb000] font-mono';
      themeCardClass = 'bg-black border-2 border-[#ffb000] shadow-[0_0_15px_rgba(255,176,0,0.25)] rounded-none';
      themeInputClass = 'bg-black border border-[#ffb000]/60 text-[#ffb000] rounded-none focus:ring-[#ffb000]';
      themeTextClass = 'text-[#ffb000]';
      themeAccentClass = 'text-[#ffb000]';
      themeBadgeClass = 'bg-[#ffb000]/10 text-[#ffb000] border border-[#ffb000]/30';
    } else if (zenTheme === 'matrix') {
      themeBgClass = 'bg-black text-[#00ff00] font-mono';
      themeCardClass = 'bg-black border-2 border-[#00ff00] shadow-[0_0_15px_rgba(0,255,0,0.25)] rounded-none';
      themeInputClass = 'bg-black border border-[#00ff00]/60 text-[#00ff00] rounded-none focus:ring-[#00ff00]';
      themeTextClass = 'text-[#00ff00]';
      themeAccentClass = 'text-[#00ff00]';
      themeBadgeClass = 'bg-[#00ff00]/10 text-[#00ff00] border border-[#00ff00]/30';
    } else if (zenTheme === 'cyberpunk') {
      themeBgClass = 'bg-[#120024]/95 text-[#00ffff]';
      themeCardClass = 'bg-[#21003d] border-2 border-[#ff007f] shadow-[0_0_20px_rgba(255,0,127,0.35)] rounded-2xl';
      themeInputClass = 'bg-[#0d001a] border border-[#ff007f]/65 text-[#00ffff] rounded-xl focus:ring-[#00ffff]';
      themeTextClass = 'text-[#00ffff]';
      themeAccentClass = 'text-[#ff007f]';
      themeBadgeClass = 'bg-[#ff007f]/10 text-[#ff007f] border border-[#ff007f]/35';
    }

    return (
      <div className={`fixed inset-0 z-50 flex flex-col justify-between p-6 overflow-y-auto animate-fade-in ${themeBgClass}`}>
        {/* Top Header */}
        <div className="max-w-3xl w-full mx-auto flex items-center justify-between border-b border-border/60 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <span className={`flex h-2.5 w-2.5 rounded-full bg-primary ${zenTheme === 'matrix' || zenTheme === 'terminal' ? 'bg-current' : 'animate-pulse'}`} />
            <h3 className="text-xs font-extrabold uppercase tracking-widest">
              {isRehearsalMode ? 'Sandbox Rehearsal Session' : 'Zen Revision Session'}
            </h3>
          </div>

          <div className="flex items-center gap-3">
            {/* Visual Skin Switcher */}
            <select
              value={zenTheme}
              onChange={(e) => setZenTheme(e.target.value as any)}
              className="px-2.5 py-1 rounded-xl border border-border bg-card text-foreground text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer select-none"
            >
              <option value="obsidian">🎨 Obsidian Dark</option>
              <option value="terminal">📟 Amber Terminal</option>
              <option value="matrix">💻 Matrix Green</option>
              <option value="cyberpunk">🌌 Cyberpunk Neon</option>
            </select>

            <button
              type="button"
              onClick={() => {
                setIsZenMode(false);
                if (isRehearsalMode) setIsRehearsalMode(false);
              }}
              className="px-3 py-1.5 rounded-xl border border-border hover:bg-muted text-xs font-bold text-muted-foreground hover:text-foreground transition-all cursor-pointer flex items-center gap-1.5 select-none"
            >
              Exit Zen Mode <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono border border-border">Esc</kbd>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="max-w-3xl w-full mx-auto mt-4 shrink-0">
          <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider mb-1.5 select-none opacity-85">
            <span>Session Progress</span>
            <span>{completedCount} of {initialTotalCount} Completed</span>
          </div>
          <div className="w-full h-1 bg-muted border border-border/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary via-primary to-violet-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Active Problem Card */}
        <div className="flex-1 max-w-3xl w-full mx-auto flex flex-col justify-center py-6">
          <div className={`border p-6 sm:p-8 space-y-6 transition-all duration-300 ${themeCardClass} ${
            isExpired ? 'border-rose-500/80 ring-2 ring-rose-500/10 shadow-rose-500/10 dark:shadow-rose-500/5' : ''
          }`}>
            {/* Title & Stats Row */}
            <div className="flex justify-between items-start gap-4">
              <div className="space-y-1">
                <span className={`text-[10px] uppercase font-extrabold tracking-widest select-none ${themeAccentClass}`}>
                  {isRehearsalMode ? 'Practice Card' : 'Active Problem'}
                </span>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight hover:underline transition-all">
                  <a
                    href={activeProblem.lcUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2"
                  >
                    {activeProblem.title}
                    <ExternalLink className="h-5 w-5 opacity-70" />
                  </a>
                </h2>
                {activeProblem.tags && (
                  <div className="flex flex-wrap gap-1 mt-1 select-none">
                    {activeProblem.tags.split(',').map(tag => (
                      <span key={tag} className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${themeBadgeClass}`}>
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Confidence dots */}
              <div className="flex gap-1 shrink-0 mt-1 select-none">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2.5 h-2.5 rounded-full ${
                      i < activeProblem.confidence
                        ? 'bg-amber-400 dark:bg-amber-500 shadow-sm'
                        : 'bg-muted border border-border/40'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Visual Timer */}
            <div className="p-3 bg-muted/20 border border-border/40 rounded-2xl flex items-center justify-between text-xs select-none">
              <span className="font-bold flex items-center gap-1.5 opacity-80">
                <Clock className="h-4 w-4" />
                Solve Timer Target:
              </span>
              {timers[activeProblem.problemId] !== undefined ? (
                <div className="flex items-center gap-2">
                  <span className={`font-mono font-extrabold px-3 py-1 rounded-xl text-sm select-none flex items-center gap-1.5 ${
                    timers[activeProblem.problemId] === 0 
                      ? 'bg-rose-500 text-white animate-pulse' 
                      : timers[activeProblem.problemId] < 60 
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' 
                      : 'bg-primary/10 text-primary border border-primary/20'
                  }`}>
                    <Timer className={`h-3.5 w-3.5 ${timerActive[activeProblem.problemId] && timers[activeProblem.problemId] > 0 ? 'animate-spin animate-duration-3000' : ''}`} />
                    {formatTime(timers[activeProblem.problemId] || 0)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTimerActive(prev => ({ ...prev, [activeProblem.problemId]: !prev[activeProblem.problemId] }))}
                    className="px-2.5 py-1 bg-card hover:bg-muted text-[10px] font-bold rounded-lg transition-all border border-border cursor-pointer"
                  >
                    {timerActive[activeProblem.problemId] ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTimerActive(prev => ({ ...prev, [activeProblem.problemId]: false }));
                      setTimers(prev => {
                        const copy = { ...prev };
                        delete copy[activeProblem.problemId];
                        return copy;
                      });
                    }}
                    className="px-2.5 py-1 bg-card hover:bg-muted text-[10px] font-bold rounded-lg transition-all border border-border cursor-pointer text-destructive"
                  >
                    Reset
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  {[5, 10, 15, 20].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => {
                        const secs = mins * 60;
                        setTimers(prev => ({ ...prev, [activeProblem.problemId]: secs }));
                        setTimerLimits(prev => ({ ...prev, [activeProblem.problemId]: secs }));
                        setTimerActive(prev => ({ ...prev, [activeProblem.problemId]: true }));
                      }}
                      className="px-2.5 py-1 rounded-lg border border-border bg-card hover:bg-muted text-[10px] font-bold transition-all cursor-pointer animate-fade-in"
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Pseudocode Sketchpad */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider select-none opacity-80">
                ✏️ Inline Pseudocode & Solution Blueprint
              </label>
              <textarea
                value={sketches[activeProblem.problemId] || ''}
                onChange={(e) => setSketches(prev => ({ ...prev, [activeProblem.problemId]: e.target.value }))}
                placeholder="Draft your thoughts, logic steps, or pseudocode here before revealing the notes..."
                rows={4}
                className={`w-full p-4 bg-background focus:outline-none placeholder-muted-foreground/60 resize-y shadow-inner border ${themeInputClass}`}
              />
            </div>

            {/* Reveal toggle or Markdown note */}
            {!revealedNotes[activeProblem.problemId] ? (
              <button
                type="button"
                onClick={() => setRevealedNotes(prev => ({ ...prev, [activeProblem.problemId]: true }))}
                className="w-full py-6 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md hover:scale-[1.01]"
              >
                <Sparkles className="h-5 w-5" />
                Reveal Key Insight <kbd className="px-1.5 py-0.5 rounded bg-primary/20 text-[10px] font-mono border border-primary/30 ml-1">Space</kbd>
              </button>
            ) : (
              <div className="space-y-4 animate-fade-in">
                {/* Note block */}
                <div className="space-y-1.5">
                  <span className="block text-xs font-bold uppercase tracking-wider select-none opacity-80">Key Insight Note</span>
                  <div className="bg-muted/20 border border-border/40 rounded-2xl p-5 text-sm max-h-48 overflow-y-auto shadow-inner leading-relaxed">
                    {renderNoteContent(activeProblem.note)}
                  </div>
                </div>

                {/* Failure Classification */}
                {!isRehearsalMode && (
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <span className="text-[10px] uppercase font-black tracking-wider text-destructive/90 flex items-center gap-1 mr-1 select-none">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Failure Type:
                    </span>
                    {['Bug', 'Corner Case', 'Efficiency', 'Pattern'].map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setFailureReasons(prev => ({ ...prev, [activeProblem.problemId]: reason }))}
                        className={`px-3 py-1 rounded-xl border text-[9px] font-bold uppercase transition-all cursor-pointer ${
                          failureReasons[activeProblem.problemId] === reason
                            ? 'bg-destructive/15 border-destructive/30 text-destructive'
                            : 'bg-background border-border/60 text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {reason}
                      </button>
                    ))}
                    {failureReasons[activeProblem.problemId] && (
                      <button
                        type="button"
                        onClick={() => setFailureReasons(prev => {
                          const copy = { ...prev };
                          delete copy[activeProblem.problemId];
                          return copy;
                        })}
                        className="text-[9px] font-bold text-muted-foreground hover:text-foreground cursor-pointer select-none"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}

                {/* Interval override controls */}
                {!isRehearsalMode && (
                  <div className="flex items-center gap-2 pt-2 border-t border-border/20">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1 select-none">
                      <Calendar className="h-3.5 w-3.5" />
                      Schedule Override:
                    </span>
                    <button
                      type="button"
                      onClick={() => setCustomIntervals(prev => ({ ...prev, [activeProblem.problemId]: null }))}
                      className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                        currentCustom === null ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-background border-border/60 text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      Auto
                    </button>
                    {[1, 3, 7, 14, 30].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setCustomIntervals(prev => ({ ...prev, [activeProblem.problemId]: days }))}
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                          currentCustom === days ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-background border-border/60 text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        +{days}d
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Bar Rating actions */}
        <div className="max-w-3xl w-full mx-auto border-t border-border/60 pt-4 flex justify-between items-center gap-4 shrink-0">
          <span className="text-[10px] text-muted-foreground font-bold select-none uppercase tracking-widest hidden sm:inline">
            {!revealedNotes[activeProblem.problemId] 
              ? "👈 Review title & draft approach, then click Space to reveal"
              : "👉 Select recall grade to continue"
            }
          </span>

          <div className="flex-1 sm:flex-none flex items-center gap-3 w-full sm:w-auto">
            {revealedNotes[activeProblem.problemId] ? (
              <>
                <button
                  type="button"
                  onClick={() => handleRate(activeProblem.problemId, 'Blank')}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-xs font-extrabold text-destructive hover:bg-destructive/10 border border-destructive/20 transition-all cursor-pointer hover:scale-[1.02] shadow-sm select-none"
                >
                  <Frown className="h-4 w-4" />
                  Blank <kbd className="px-1.5 py-0.5 rounded bg-destructive/10 text-[9px] border border-destructive/20">1</kbd> ({isRehearsalMode ? 'Practice' : currentCustom !== null ? `${currentCustom}d` : '1d'})
                </button>

                <button
                  type="button"
                  onClick={() => handleRate(activeProblem.problemId, 'Shaky')}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-xs font-extrabold text-amber-500 hover:bg-amber-500/10 border border-amber-500/20 transition-all cursor-pointer hover:scale-[1.02] shadow-sm select-none"
                >
                  <AlertCircle className="h-4 w-4" />
                  Shaky <kbd className="px-1.5 py-0.5 rounded bg-amber-500/10 text-[9px] border border-amber-500/20">2</kbd> ({isRehearsalMode ? 'Practice' : currentCustom !== null ? `${currentCustom}d` : `${getNextIntervalPreview(activeProblem.intervalDays, 'Shaky')}d`})
                </button>

                <button
                  type="button"
                  onClick={() => handleRate(activeProblem.problemId, 'GotIt')}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 bg-primary text-primary-foreground font-extrabold rounded-2xl hover:opacity-95 transition-all cursor-pointer hover:scale-[1.02] shadow-lg shadow-primary/10 select-none"
                >
                  <Check className="h-4 w-4" />
                  Got It <kbd className="px-1.5 py-0.5 rounded bg-primary-foreground/20 text-[9px] border border-primary-foreground/10 ml-1">3</kbd> ({isRehearsalMode ? 'Practice' : currentCustom !== null ? `${currentCustom}d` : `${getNextIntervalPreview(activeProblem.intervalDays, 'GotIt')}d`})
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setRevealedNotes(prev => ({ ...prev, [activeProblem.problemId]: true }))}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 bg-primary text-primary-foreground font-extrabold rounded-2xl hover:opacity-95 transition-all cursor-pointer shadow-lg shadow-primary/10 select-none"
              >
                Reveal Insight <kbd className="px-1.5 py-0.5 rounded bg-primary-foreground/25 text-[9px] border border-primary-foreground/15 ml-1">Space</kbd>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 animate-fade-in">
      
      {/* LEETCODE SUBMISSION AUTO-SYNC */}
      {leetcodeUsername ? (
        recentSubmissions.length > 0 && (
          <div className="bg-card border border-border shadow-xl rounded-2xl p-6 space-y-4 backdrop-blur-md relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-primary/5 blur-xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-foreground flex items-center gap-2 text-sm sm:text-base">
                  <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  Auto-Detected Solved Problems
                </h3>
                <p className="text-xs text-muted-foreground">Connected to LeetCode user <strong className="text-foreground">{leetcodeUsername}</strong>.</p>
              </div>
              <button 
                onClick={fetchSubmissions}
                disabled={fetchingSubmissions}
                className="p-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50"
                title="Refresh Submissions"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${fetchingSubmissions ? 'animate-spin' : ''}`} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recentSubmissions.map((sub) => {
                const minutesAgo = Math.max(1, Math.round((Date.now() - sub.timestamp) / 60000));
                let timeStr = `${minutesAgo}m ago`;
                if (minutesAgo >= 60) {
                  const hours = Math.round(minutesAgo / 60);
                  timeStr = `${hours}h ago`;
                }

                return (
                  <div key={sub.lcUrl} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50 hover:border-primary/20 transition-all">
                    <div className="truncate max-w-[70%]">
                      <h4 className="font-bold text-xs text-foreground truncate">{sub.title}</h4>
                      <span className="text-[10px] text-muted-foreground font-semibold">{timeStr}</span>
                    </div>
                    <button
                      onClick={() => {
                        setUrl(sub.lcUrl);
                        setTitle(sub.title);
                        setIsFormOpen(true);
                        setTimeout(() => {
                          const el = document.getElementById('log-note-textarea');
                          if (el) el.focus();
                        }, 200);
                      }}
                      className="px-2.5 py-1 text-[10px] font-extrabold uppercase bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all cursor-pointer"
                    >
                      Log Note
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : (
        <div className="p-4 rounded-2xl border border-primary/25 bg-primary/5 text-xs text-primary/95 flex items-start gap-2.5 shadow-sm">
          <span className="text-sm">💡</span>
          <p className="leading-relaxed">
            <strong>Pro Study Sync:</strong> Connect your LeetCode username in{' '}
            <a href="/settings" className="font-bold underline hover:opacity-80">Settings</a>{' '}
            to auto-sync your solved problems directly onto this dashboard in real-time!
          </p>
        </div>
      )}

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
                  Key Insights (Supports code blocks and inline code `using backticks`)
                </label>
                <span className={`text-xs ${note.length > 750 ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                  {note.length} / 800
                </span>
              </div>
              
              {/* Note Templates Selection */}
              <div className="flex flex-wrap items-center gap-1.5 mb-2.5 bg-muted/20 p-1.5 rounded-lg border border-border/20 select-none">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1 mr-1">Templates:</span>
                {[
                  { name: 'Complexity', text: '* Time Complexity: O()\n* Space Complexity: O()\n* Logic: ' },
                  { name: 'Gotchas', text: '* Core Idea: \n* Edge Cases: \n* Common Bugs: ' },
                  { name: 'Pre-Verify', text: '* [ ] Dry run mock input\n* [ ] Verify bounds & empty inputs\n* [ ] Check recursion depth/overflow' }
                ].map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => setNote(prev => prev + (prev.length > 0 ? '\n' : '') + t.text)}
                    className="px-2 py-0.5 rounded border border-border bg-card hover:bg-muted text-[10px] font-semibold text-muted-foreground transition-all cursor-pointer"
                  >
                    + {t.name}
                  </button>
                ))}
              </div>

              <textarea
                id="log-note-textarea"
                required
                maxLength={800}
                placeholder="What was the key insight? e.g., 'Use two-pointers from both ends after sorting. Remember to handle duplicate values by skipping...'"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder-muted-foreground/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-y"
              />
            </div>

            {/* Tags (comma separated) */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Tags (Comma Separated, e.g. DP, Graph, Recursion)
              </label>
              <input
                type="text"
                placeholder="e.g. DP, Trees, Stack"
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder-muted-foreground/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
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
        <div className="flex flex-col gap-4 border-b border-border pb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Bookmark className="h-5 w-5 text-primary" />
              Daily Revision Queue
            </h2>
            <div className="flex items-center gap-2">
              {queue.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsZenMode(true)}
                  className="px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-xl border border-primary/20 hover:border-primary/30 transition-all flex items-center gap-1 cursor-pointer select-none"
                >
                  ✨ Zen Mode
                </button>
              )}
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary">
                {queue.length} Due Today
              </span>
            </div>
          </div>

          {/* Sleek Habit Progress Bar */}
          {initialTotalCount > 0 && (
            <div className="space-y-2 bg-card/30 border border-border/40 rounded-2xl p-4 shadow-sm">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-semibold uppercase tracking-wider">Daily Progress</span>
                <span className="font-extrabold text-foreground">{completedCount} of {initialTotalCount} Completed</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-muted border border-border/20 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary/80 via-primary to-violet-500 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {queue.length === 0 ? (
          /* Premium Streak Celebration Screen */
          <div className="relative overflow-hidden bg-card border border-border shadow-2xl rounded-2xl p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-6 backdrop-blur-md">
            <div className="absolute -top-12 -left-12 w-36 h-36 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -bottom-12 -right-12 w-36 h-36 rounded-full bg-amber-500/10 blur-3xl" />

            <div className="relative flex items-center justify-center">
              <div className="absolute animate-ping inline-flex h-16 w-16 rounded-full bg-amber-500/15 opacity-75 animate-duration-1000" />
              <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 dark:from-amber-500 dark:to-amber-700 text-white shadow-lg shadow-amber-500/20 relative">
                <Flame className="h-8 w-8 text-white" />
              </div>
            </div>

            <div className="space-y-2 max-w-sm">
              <h3 className="text-2xl font-extrabold tracking-tight text-foreground">
                All Caught Up!
              </h3>
              <p className="text-sm text-muted-foreground">
                You've cleared all scheduled revisions for today. Keep the momentum going!
              </p>
            </div>

            {streak !== null && (
              <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-muted/60 border border-border/60 backdrop-blur-sm shadow-sm transition-all duration-300 hover:border-amber-500/30">
                <span className="text-sm font-bold text-foreground">
                  Streak:
                </span>
                <span className="text-sm font-extrabold text-amber-500 flex items-center gap-1.5">
                  <Flame className="h-4 w-4 fill-amber-500" />
                  {streak} Day{streak !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={startRehearsalSession}
              disabled={loading}
              className="px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-95 shadow-md shadow-primary/10 transition-all text-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50 select-none"
            >
              {loading ? <Loader className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 animate-pulse" />}
              Start Rehearsal Session (Practice Sandbox)
            </button>
          </div>
        ) : (
          /* Queue Cards */
          <div className="space-y-4">
            {queue.map((problem) => {
              const isFading = fadingId === problem.problemId;
              const currentCustom = customIntervals[problem.problemId] || null;

              return (
                <div
                  key={problem.problemId}
                  className={`bg-card border shadow-md rounded-2xl p-6 transition-all duration-200 transform ${
                    timers[problem.problemId] === 0
                      ? 'border-rose-500/80 shadow-lg shadow-rose-500/10 dark:shadow-rose-500/5 ring-1 ring-rose-500/20'
                      : 'border-border'
                  } ${
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

                  {/* Practice Timer */}
                  <div className="flex items-center gap-2 mb-4 p-2 bg-muted/20 border border-border/40 rounded-xl text-xs justify-between select-none">
                    <span className="font-bold text-muted-foreground flex items-center gap-1.5 select-none">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      Practice Timer:
                    </span>
                    {timers[problem.problemId] !== undefined ? (
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-extrabold px-2 py-0.5 rounded text-xs select-none flex items-center gap-1 ${
                          timers[problem.problemId] === 0 
                            ? 'bg-rose-500 text-white animate-pulse' 
                            : timers[problem.problemId] < 60 
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' 
                            : 'bg-primary/10 text-primary border border-primary/20'
                        }`}>
                          <Timer className={`h-3 w-3 ${timerActive[problem.problemId] && timers[problem.problemId] > 0 ? 'animate-spin animate-duration-3000' : ''}`} />
                          {formatTime(timers[problem.problemId] || 0)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setTimerActive(prev => ({ ...prev, [problem.problemId]: !prev[problem.problemId] }))}
                          className="px-2 py-0.5 rounded bg-card hover:bg-muted text-[10px] font-bold text-foreground transition-all cursor-pointer border border-border"
                        >
                          {timerActive[problem.problemId] ? 'Pause' : 'Resume'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTimerActive(prev => ({ ...prev, [problem.problemId]: false }));
                            setTimers(prev => {
                              const copy = { ...prev };
                              delete copy[problem.problemId];
                              return copy;
                            });
                          }}
                          className="px-2 py-0.5 rounded bg-card hover:bg-muted text-[10px] font-bold text-destructive transition-all cursor-pointer border border-border"
                        >
                          Reset
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {[5, 10, 15, 20].map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => {
                              const secs = mins * 60;
                              setTimers(prev => ({ ...prev, [problem.problemId]: secs }));
                              setTimerLimits(prev => ({ ...prev, [problem.problemId]: secs }));
                              setTimerActive(prev => ({ ...prev, [problem.problemId]: true }));
                            }}
                            className="px-2 py-0.5 rounded border border-border bg-card hover:bg-muted text-[10px] font-bold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                          >
                            {mins}m
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Topic Mastery & Prerequisites Mapping Badges */}
                  <div className="flex flex-col gap-2 mb-4">
                    {/* Mastery Level Badge */}
                    <div className="flex items-center gap-2 select-none">
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground">Topic Mastery:</span>
                      <div className="w-16 h-1.5 rounded-full bg-muted border border-border/10 overflow-hidden inline-block">
                        <div 
                          className={`h-full rounded-full ${
                            problem.confidence >= 4 
                              ? 'bg-green-500' 
                              : problem.confidence >= 3 
                              ? 'bg-amber-400' 
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${(problem.confidence / 5) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-foreground">{(problem.confidence / 5) * 100}%</span>
                    </div>

                    {/* Related Pattern Mapping Graph */}
                    {problem.tags && (
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="font-extrabold text-muted-foreground uppercase tracking-wider">Concept Hops:</span>
                        {problem.tags.split(',').map((tag) => {
                          const cleanTag = tag.trim().toLowerCase();
                          let prerequisite = '';
                          if (cleanTag.includes('dp') || cleanTag.includes('dynamic')) prerequisite = 'Recursion ➔ Memoization';
                          else if (cleanTag.includes('graph') || cleanTag.includes('tree')) prerequisite = 'DFS/BFS ➔ Adjacency List';
                          else if (cleanTag.includes('sliding') || cleanTag.includes('window')) prerequisite = 'Two Pointers';
                          else prerequisite = 'Basic Arrays';

                          return (
                            <span key={tag} className="px-2 py-0.5 rounded bg-muted/60 border border-border/60 text-muted-foreground font-semibold">
                              {prerequisite}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Pseudocode Editor Sandbox */}
                  <div className="mb-4 border-t border-border/20 pt-3">
                    <div className="flex justify-between items-center mb-2">
                      <button
                        type="button"
                        onClick={() => setOpenSketches(prev => ({ ...prev, [problem.problemId]: !prev[problem.problemId] }))}
                        className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
                      >
                        <span>💻 Code & Sketchpad Sandbox</span>
                        <span className="text-[10px] font-normal opacity-70">({sketches[problem.problemId] ? 'Active' : 'Open'})</span>
                      </button>
                      
                      {openSketches[problem.problemId] && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSketchModes(prev => ({ ...prev, [problem.problemId]: prev[problem.problemId] === 'editor' ? 'text' : 'editor' }))}
                            className="px-2 py-0.5 rounded border border-border bg-card text-[9px] font-bold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                          >
                            Mode: {sketchModes[problem.problemId] === 'editor' ? 'IDE Editor' : 'Plain Text'}
                          </button>
                          <button
                            type="button"
                            onClick={() => validatePseudocode(problem.problemId, sketches[problem.problemId] || '')}
                            className="px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-[9px] font-bold text-primary hover:bg-primary/20 transition-all cursor-pointer"
                          >
                            Verify Delimiters
                          </button>
                        </div>
                      )}
                    </div>

                    {openSketches[problem.problemId] && (
                      <div className="space-y-2 animate-fade-in">
                        {sketchModes[problem.problemId] === 'editor' ? (
                          <div className="relative border border-border/80 rounded-xl overflow-hidden font-mono bg-[#1E1E1E] text-slate-200 p-2">
                            <div className="absolute left-0 top-0 bottom-0 w-8 bg-zinc-900 border-r border-zinc-800 text-zinc-600 text-right pr-2 select-none pt-2 text-[11px] leading-relaxed">
                              {Array.from({ length: Math.max(3, (sketches[problem.problemId] || '').split('\n').length) }).map((_, i) => (
                                <div key={i}>{i + 1}</div>
                              ))}
                            </div>
                            <textarea
                              value={sketches[problem.problemId] || ''}
                              onChange={(e) => setSketches(prev => ({ ...prev, [problem.problemId]: e.target.value }))}
                              placeholder="def solve(nums):&#10;    # Write your pseudocode or implementation here...&#10;    pass"
                              rows={4}
                              className="w-full pl-8 bg-transparent text-slate-200 text-xs focus:outline-none resize-y leading-relaxed font-mono focus:ring-0 focus:border-transparent"
                            />
                          </div>
                        ) : (
                          <textarea
                            value={sketches[problem.problemId] || ''}
                            onChange={(e) => setSketches(prev => ({ ...prev, [problem.problemId]: e.target.value }))}
                            placeholder="Type out your algorithm steps or pseudocode here to sketch your thoughts before revealing..."
                            rows={3}
                            className="w-full p-3 bg-background border border-border rounded-xl text-xs font-mono text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                          />
                        )}

                        {runValidationResults[problem.problemId] && (
                          <div className={`p-2.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 animate-fade-in ${
                            runValidationResults[problem.problemId]?.success
                              ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400'
                              : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                          }`}>
                            <span>{runValidationResults[problem.problemId]?.success ? '✓' : '⚠'}</span>
                            <span className="flex-1">{runValidationResults[problem.problemId]?.message}</span>
                            <button
                              type="button"
                              onClick={() => setRunValidationResults(prev => ({ ...prev, [problem.problemId]: null }))}
                              className="text-[10px] opacity-75 hover:opacity-100 font-bold ml-2 cursor-pointer"
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Variable Trace Grid */}
                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={() => {
                        setTraceGrids(prev => {
                          const existing = prev[problem.problemId];
                          if (existing) {
                            const copy = { ...prev };
                            delete copy[problem.problemId];
                            return copy;
                          } else {
                            return {
                              ...prev,
                              [problem.problemId]: {
                                columns: ['step', 'variables/state', 'notes'],
                                rows: [{ step: '1', 'variables/state': '', notes: 'Initialization' }]
                              }
                            };
                          }
                        });
                      }}
                      className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5 select-none cursor-pointer"
                    >
                      <span>📊 Variable Tracer (Dry Run)</span>
                      <span className="text-[10px] font-normal opacity-70">({traceGrids[problem.problemId] ? 'Active' : 'Add tracer'})</span>
                    </button>

                    {traceGrids[problem.problemId] && (
                      <div className="mt-2 bg-background border border-border/80 rounded-xl p-3 space-y-3 animate-fade-in">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-foreground">Trace Table</span>
                          <button
                            type="button"
                            onClick={() => {
                              setTraceGrids(prev => {
                                const grid = prev[problem.problemId];
                                const newRows = [...grid.rows, { step: String(grid.rows.length + 1), 'variables/state': '', notes: '' }];
                                return {
                                  ...prev,
                                  [problem.problemId]: { ...grid, rows: newRows }
                                };
                              });
                            }}
                            className="px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                          >
                            + Add Row
                          </button>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs text-foreground divide-y divide-border border border-border/60 rounded-lg overflow-hidden">
                            <thead className="bg-muted/50 font-bold uppercase tracking-wider text-[10px]">
                              <tr>
                                {traceGrids[problem.problemId].columns.map(col => (
                                  <th key={col} className="px-3 py-2 text-left">{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                              {traceGrids[problem.problemId].rows.map((row, idx) => (
                                <tr key={idx}>
                                  <td className="px-3 py-1.5 font-bold font-mono text-muted-foreground">{row.step}</td>
                                  <td className="px-3 py-1.5">
                                    <input
                                      type="text"
                                      value={row['variables/state'] || ''}
                                      placeholder="e.g. i=0, j=4, sum=10"
                                      onChange={(e) => {
                                        const newVal = e.target.value;
                                        setTraceGrids(prev => {
                                          const grid = prev[problem.problemId];
                                          const newRows = [...grid.rows];
                                          newRows[idx] = { ...newRows[idx], 'variables/state': newVal };
                                          return {
                                            ...prev,
                                            [problem.problemId]: { ...grid, rows: newRows }
                                          };
                                        });
                                      }}
                                      className="w-full bg-background border border-border/40 rounded px-2 py-1 focus:ring-1 focus:ring-primary focus:outline-none"
                                    />
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <input
                                      type="text"
                                      value={row.notes || ''}
                                      placeholder="e.g. nums[mid] < target"
                                      onChange={(e) => {
                                        const newVal = e.target.value;
                                        setTraceGrids(prev => {
                                          const grid = prev[problem.problemId];
                                          const newRows = [...grid.rows];
                                          newRows[idx] = { ...newRows[idx], notes: newVal };
                                          return {
                                            ...prev,
                                            [problem.problemId]: { ...grid, rows: newRows }
                                          };
                                        });
                                      }}
                                      className="w-full bg-background border border-border/40 rounded px-2 py-1 focus:ring-1 focus:ring-primary focus:outline-none"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Active Recall: Reveal Insight Toggle */}
                  {!revealedNotes[problem.problemId] ? (
                    <button
                      onClick={() => setRevealedNotes(prev => ({ ...prev, [problem.problemId]: true }))}
                      className="w-full py-4 mb-6 rounded-xl border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-extrabold uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Sparkles className="h-4 w-4" />
                      Reveal Key Insight
                    </button>
                  ) : (
                    /* Note block - rendered with markdown code block formatting and TTS reader */
                    <div className="bg-muted/40 border border-border/40 rounded-xl p-4 mb-6 text-sm animate-fade-in">
                      <div className="flex justify-between items-start gap-4 mb-2 border-b border-border/20 pb-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          💡 Key Insights
                        </span>
                        <button
                          type="button"
                          onClick={() => playAudioNote(problem.problemId, problem.title, problem.note)}
                          className="shrink-0 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-all cursor-pointer flex items-center gap-1.5"
                          title={playingAudioId === problem.problemId ? "Stop Reading" : "Read Aloud"}
                        >
                          {playingAudioId === problem.problemId ? (
                            <div className="flex items-center gap-1 select-none h-4">
                              <span className="w-0.5 h-3.5 bg-primary rounded-full animate-bounce animate-duration-500" />
                              <span className="w-0.5 h-4.5 bg-primary rounded-full animate-bounce animate-duration-300" />
                              <span className="w-0.5 h-2.5 bg-primary rounded-full animate-bounce animate-duration-700" />
                            </div>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>
                          )}
                          <span className="text-[9px] font-bold uppercase tracking-wider">{playingAudioId === problem.problemId ? "Playing" : "Read Aloud"}</span>
                        </button>
                      </div>
                      <div className="leading-relaxed text-foreground/90">{renderNoteContent(problem.note)}</div>
                    </div>
                  )}

                  {/* Failure reason selector for Blank/Shaky rating */}
                  {revealedNotes[problem.problemId] && (
                    <div className="flex flex-wrap items-center gap-1.5 border-t border-border/20 pt-4 mb-4 animate-fade-in">
                      <span className="text-[10px] uppercase font-extrabold tracking-wider text-destructive/85 flex items-center gap-1 mr-1">
                        <AlertTriangle className="h-3 w-3" />
                        Classify Failure:
                      </span>
                      {['Bug', 'Corner Case', 'Efficiency', 'Pattern'].map((reason) => (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => setFailureReasons(prev => ({ ...prev, [problem.problemId]: reason }))}
                          className={`px-2 py-0.5 rounded-lg border text-[9px] font-bold uppercase transition-all cursor-pointer ${
                            failureReasons[problem.problemId] === reason
                              ? 'bg-destructive/15 border-destructive/30 text-destructive'
                              : 'bg-muted/40 border-border/50 text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {reason}
                        </button>
                      ))}
                      {failureReasons[problem.problemId] && (
                        <button
                          type="button"
                          onClick={() => setFailureReasons(prev => {
                            const copy = { ...prev };
                            delete copy[problem.problemId];
                            return copy;
                          })}
                          className="text-[9px] font-extrabold text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}

                  {/* Card Footer Rating Buttons & Custom Overrides */}
                  <div className="flex flex-col gap-4 border-t border-border/20 pt-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      
                      {/* Custom Override Pill Selector */}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-muted-foreground">
                          Current interval: <span className="font-semibold">{problem.intervalDays} day{problem.intervalDays > 1 ? 's' : ''}</span>
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mr-1 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Next due:
                          </span>
                          <button
                            type="button"
                            onClick={() => setCustomIntervals(prev => ({ ...prev, [problem.problemId]: null }))}
                            className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold tracking-tight transition-all cursor-pointer ${
                              currentCustom === null
                                ? 'bg-primary/15 border-primary/30 text-primary'
                                : 'bg-muted/40 border-border/50 text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            Auto
                          </button>
                          {[1, 3, 7, 14, 30].map((days) => (
                            <button
                              key={days}
                              type="button"
                              onClick={() => setCustomIntervals(prev => ({ ...prev, [problem.problemId]: days }))}
                              className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold tracking-tight transition-all cursor-pointer ${
                                currentCustom === days
                                  ? 'bg-primary/15 border-primary/30 text-primary'
                                  : 'bg-muted/40 border-border/50 text-muted-foreground hover:bg-muted'
                              }`}
                            >
                              +{days}d
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Action Rating Buttons */}
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          onClick={() => handleRate(problem.problemId, 'Blank')}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-destructive hover:bg-destructive/10 border border-destructive/20 transition-all cursor-pointer"
                        >
                          <Frown className="h-3.5 w-3.5" />
                          Blank ({currentCustom !== null ? `${currentCustom}d` : '1d'})
                        </button>

                        <button
                          onClick={() => handleRate(problem.problemId, 'Shaky')}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-amber-500 hover:bg-amber-500/10 border border-amber-500/20 transition-all cursor-pointer"
                        >
                          <AlertCircle className="h-3.5 w-3.5" />
                          Shaky ({currentCustom !== null ? `${currentCustom}d` : `${getNextIntervalPreview(problem.intervalDays, 'Shaky')}d`})
                        </button>

                        <button
                          onClick={() => handleRate(problem.problemId, 'GotIt')}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-green-600 dark:text-green-400 hover:bg-green-500/10 border border-green-500/20 transition-all cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Got It ({currentCustom !== null ? `${currentCustom}d` : `${getNextIntervalPreview(problem.intervalDays, 'GotIt')}d`})
                        </button>
                      </div>

                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {/* WEEKLY REVISION ACTIVITY CHART */}
        <div className="bg-card border border-border shadow-xl rounded-2xl p-6 space-y-4 backdrop-blur-md mt-8 select-none">
          <div>
            <h3 className="font-extrabold text-foreground text-sm sm:text-base">
              Weekly Revision Velocity
            </h3>
            <p className="text-xs text-muted-foreground">Number of spaced repetition self-tests completed this week.</p>
          </div>

          <div className="flex items-end justify-between h-32 pt-4 px-2 border-b border-border/60">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
              const count = weeklySummary[day] || 0;
              const maxVal = Math.max(...Object.values(weeklySummary), 4);
              const percentHeight = Math.max(8, Math.min(100, (count / maxVal) * 100));
              const barColor = count > 0 ? 'bg-primary' : 'bg-muted border border-border/10';

              return (
                <div key={day} className="flex flex-col items-center flex-1 group relative">
                  <div className="absolute bottom-full mb-1.5 px-2 py-1 bg-popover border border-border rounded text-[10px] text-popover-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-sm font-bold">
                    {count} review{count !== 1 ? 's' : ''}
                  </div>
                  <div 
                    className={`w-5 sm:w-8 rounded-t-lg transition-all duration-500 ease-out hover:scale-x-105 cursor-pointer ${barColor}`}
                    style={{ height: `${percentHeight}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground font-bold mt-2">{day}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
