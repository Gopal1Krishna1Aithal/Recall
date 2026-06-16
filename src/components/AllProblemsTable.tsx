'use client';

import React, { useState } from 'react';
import { updateProblemNoteAction, deleteProblemAction, forceDueTodayAction } from '@/app/actions/problemActions';
import { renderNoteContent, unescapeHtml } from '@/lib/markdown';
import { 
  Search, 
  ArrowUpDown, 
  Edit2, 
  Trash2, 
  Check, 
  X, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp,
  Loader,
  Calendar
} from 'lucide-react';

interface RevisionHistoryItem {
  reviewId: string;
  rating: string;
  failureReason?: string | null;
  sketch?: string | null;
  reviewedAt: Date | string;
}

interface Problem {
  problemId: string;
  title: string;
  lcUrl: string;
  note: string;
  confidence: number;
  intervalDays: number;
  nextDue: Date | string;
  tags?: string | null;
  history?: RevisionHistoryItem[];
}

interface AllProblemsTableProps {
  initialProblems: Problem[];
}

type SortField = 'nextDue' | 'confidence';
type SortOrder = 'asc' | 'desc';

export default function AllProblemsTable({ initialProblems }: AllProblemsTableProps) {
  const [problems, setProblems] = useState<Problem[]>(initialProblems);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('nextDue');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Advanced Filters State
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [weaknessFilter, setWeaknessFilter] = useState<string>('all');
  const [dueFilter, setDueFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');

  // Memoize all unique tags
  const allTags = React.useMemo(() => {
    const tagsSet = new Set<string>();
    problems.forEach((p) => {
      if (p.tags) {
        p.tags.split(',').forEach((t) => {
          const trimmed = t.trim();
          if (trimmed) tagsSet.add(trimmed);
        });
      }
    });
    return Array.from(tagsSet);
  }, [problems]);

  // Expanded notes state
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleSaveNote = async (problemId: string) => {
    if (!editNote.trim()) return;
    setSavingId(problemId);

    const res = await updateProblemNoteAction(problemId, editNote);

    setSavingId(null);
    if (res.success) {
      setProblems((prev) =>
        prev.map((p) => (p.problemId === problemId ? { ...p, note: editNote } : p))
      );
      setEditingId(null);
    } else {
      alert(res.error || 'Failed to update note.');
    }
  };

  const handleDelete = async (problemId: string) => {
    if (!confirm('Are you sure you want to delete this problem log?')) return;
    setDeletingId(problemId);

    const res = await deleteProblemAction(problemId);

    setDeletingId(null);
    if (res.success) {
      setProblems((prev) => prev.filter((p) => p.problemId !== problemId));
    } else {
      alert(res.error || 'Failed to delete problem.');
    }
  };

  // Filter and Sort problems
  const filteredProblems = problems.filter((problem) => {
    // 1. Search Query filter
    const matchesSearch =
      problem.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      problem.note.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // 2. Rating Filter
    if (ratingFilter !== 'all') {
      if (ratingFilter === '1-2' && (problem.confidence < 1 || problem.confidence > 2)) return false;
      if (ratingFilter === '3-4' && (problem.confidence < 3 || problem.confidence > 4)) return false;
      if (ratingFilter === '5' && problem.confidence !== 5) return false;
    }

    // 3. Weakness Filter
    if (weaknessFilter !== 'all') {
      const hasWeakness = problem.history?.some((h) => h.failureReason === weaknessFilter);
      if (!hasWeakness) return false;
    }

    // 4. Due Status Filter
    if (dueFilter !== 'all') {
      const now = new Date();
      const nextDueDate = new Date(problem.nextDue);
      const isDue = nextDueDate <= now;
      if (dueFilter === 'due' && !isDue) return false;
      if (dueFilter === 'future' && isDue) return false;
    }

    // 5. Tag Filter
    if (tagFilter !== 'all') {
      if (!problem.tags) return false;
      const tagsArray = problem.tags.split(',').map((t) => t.trim().toLowerCase());
      if (!tagsArray.includes(tagFilter.toLowerCase())) return false;
    }

    return true;
  });

  const sortedProblems = [...filteredProblems].sort((a, b) => {
    let comparison = 0;

    if (sortField === 'nextDue') {
      const dateA = new Date(a.nextDue).getTime();
      const dateB = new Date(b.nextDue).getTime();
      comparison = dateA - dateB;
    } else if (sortField === 'confidence') {
      comparison = a.confidence - b.confidence;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const formatDate = (dateStr: Date | string) => {
    if (!mounted) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Search and Headers */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">All Logged Problems</h2>
          <p className="text-xs text-muted-foreground">Manage notes, confidence levels, and schedules.</p>
        </div>

        {/* Filter and Search Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Due Status Filter */}
          <select
            value={dueFilter}
            onChange={(e) => setDueFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-input bg-card text-foreground text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary transition-all cursor-pointer"
          >
            <option value="all">📅 All Schedules</option>
            <option value="due">Due Today / Overdue</option>
            <option value="future">Scheduled Future</option>
          </select>

          {/* Confidence Filter */}
          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-input bg-card text-foreground text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary transition-all cursor-pointer"
          >
            <option value="all">⭐ All Ratings</option>
            <option value="1-2">1-2 Stars (Low)</option>
            <option value="3-4">3-4 Stars (Medium)</option>
            <option value="5">5 Stars (High)</option>
          </select>

          {/* Weakness Filter */}
          <select
            value={weaknessFilter}
            onChange={(e) => setWeaknessFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-input bg-card text-foreground text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary transition-all cursor-pointer"
          >
            <option value="all">⚠️ All Weaknesses</option>
            <option value="Bug">Bug Failures</option>
            <option value="Corner Case">Corner Cases</option>
            <option value="Efficiency">Efficiency Issues</option>
            <option value="Pattern">Pattern Recognition</option>
          </select>

          {/* Tag Filter */}
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-input bg-card text-foreground text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary transition-all cursor-pointer max-w-[150px] truncate"
          >
            <option value="all">🏷️ All Tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>

          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search problems..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-input bg-card text-foreground placeholder-muted-foreground/60 text-xs focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>
        </div>
      </div>

      {/* Problems List Table Wrapper */}
      <div className="bg-card border border-border rounded-2xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="px-6 py-4">Problem</th>
                <th className="px-6 py-4 hidden md:table-cell">Key Insight Note</th>
                <th 
                  className="px-6 py-4 cursor-pointer hover:bg-muted/80 transition-colors"
                  onClick={() => handleSort('confidence')}
                >
                  <div className="flex items-center gap-1.5">
                    Confidence
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </div>
                </th>
                <th 
                  className="px-6 py-4 cursor-pointer hover:bg-muted/80 transition-colors"
                  onClick={() => handleSort('nextDue')}
                >
                  <div className="flex items-center gap-1.5">
                    Next Due
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </div>
                </th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-sm">
              {sortedProblems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    No problems found. Start by adding one from the Today Queue!
                  </td>
                </tr>
              ) : (
                sortedProblems.map((problem) => {
                  const isExpanded = expandedId === problem.problemId;
                  const isEditing = editingId === problem.problemId;

                  return (
                    <React.Fragment key={problem.problemId}>
                      <tr className="hover:bg-muted/30 transition-colors align-middle">
                        {/* Title Link with Tag Badges */}
                        <td className="px-6 py-4 font-bold text-foreground max-w-[200px] truncate">
                          <div className="space-y-1">
                            <a
                              href={problem.lcUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-primary hover:underline inline-flex items-center gap-1"
                            >
                              {problem.title}
                              <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                            </a>
                            {problem.tags && (
                              <div className="flex flex-wrap gap-1">
                                {problem.tags.split(',').map((t) => (
                                  <span
                                    key={t}
                                    className="px-1.5 py-0.5 rounded bg-muted/70 text-[9px] text-muted-foreground font-semibold uppercase tracking-tight"
                                  >
                                    {t.trim()}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Text note snippet */}
                        <td className="px-6 py-4 hidden md:table-cell max-w-xs">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <textarea
                                value={editNote}
                                onChange={(e) => setEditNote(e.target.value)}
                                rows={2}
                                maxLength={800}
                                className="w-full p-2 border border-input rounded-lg bg-background text-sm text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                              />
                            </div>
                          ) : (
                            <div 
                              onClick={() => {
                                setExpandedId(isExpanded ? null : problem.problemId);
                              }}
                              className="cursor-pointer group flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <span className="truncate max-w-[250px] inline-block">
                                {problem.note}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                              ) : (
                                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground/60 group-hover:text-foreground" />
                              )}
                            </div>
                          )}
                        </td>

                        {/* Confidence dots */}
                        <td className="px-6 py-4">
                          <div className="flex gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <div
                                key={i}
                                className={`w-2 h-2 rounded-full ${
                                  i < problem.confidence ? 'bg-amber-400 dark:bg-amber-500' : 'bg-muted border border-border'
                                }`}
                              />
                            ))}
                          </div>
                        </td>

                        {/* Next Due Date */}
                        <td className="px-6 py-4 whitespace-nowrap text-muted-foreground text-xs font-semibold">
                          {formatDate(problem.nextDue)}
                        </td>

                        {/* Actions buttons */}
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => handleSaveNote(problem.problemId)}
                                  disabled={savingId === problem.problemId}
                                  className="p-1.5 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 transition-all cursor-pointer"
                                  title="Save Note"
                                >
                                  {savingId === problem.problemId ? (
                                    <Loader className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Check className="h-4 w-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-all cursor-pointer"
                                  title="Cancel"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                {/* Mobile Note Expander (since the table column is hidden on mobile) */}
                                <button
                                  onClick={() => setExpandedId(isExpanded ? null : problem.problemId)}
                                  className="md:hidden p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                                  title="View Note"
                                >
                                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </button>
                                 <button
                                   onClick={async () => {
                                     const res = await forceDueTodayAction(problem.problemId);
                                     if (res.success) {
                                       alert(`"${problem.title}" is now due today! Check your Today queue.`);
                                       // Update nextDue locally so client updates
                                       setProblems((prev) =>
                                         prev.map((p) =>
                                           p.problemId === problem.problemId ? { ...p, nextDue: new Date() } : p
                                         )
                                       );
                                     } else {
                                       alert(res.error || 'Failed to reschedule.');
                                     }
                                   }}
                                   className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all cursor-pointer"
                                   title="Force Due Today (Review Now)"
                                 >
                                   <Calendar className="h-4 w-4" />
                                 </button>
                                 <button
                                   onClick={() => {
                                     setEditingId(problem.problemId);
                                     setEditNote(unescapeHtml(problem.note));
                                     setExpandedId(null);
                                   }}
                                   className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                                   title="Edit Note"
                                 >
                                   <Edit2 className="h-4 w-4" />
                                 </button>
                                <button
                                  onClick={() => handleDelete(problem.problemId)}
                                  disabled={deletingId === problem.problemId}
                                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
                                  title="Delete Problem"
                                >
                                  {deletingId === problem.problemId ? (
                                    <Loader className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded row details */}
                      {isExpanded && (
                        <tr className="bg-muted/20 animate-fade-in">
                          <td colSpan={5} className="px-6 py-4 border-b border-border/40">
                            <div className="space-y-4 max-w-3xl">
                              <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                                  Revision Insight Note
                                </h4>
                                <div className="text-sm text-foreground/90 leading-relaxed bg-background p-4 rounded-xl border border-border/40">
                                  {renderNoteContent(problem.note)}
                                </div>
                              </div>
                              <div className="flex gap-4 text-xs text-muted-foreground">
                                <span>Interval: <strong className="text-foreground">{problem.intervalDays} day{problem.intervalDays > 1 ? 's' : ''}</strong></span>
                                <span>Confidence rating: <strong className="text-foreground">{problem.confidence} / 5</strong></span>
                              </div>

                              {/* Revision History Timeline */}
                              {problem.history && problem.history.length > 0 && (
                                <div className="space-y-2 pt-2 border-t border-border/20">
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Revision History Timeline
                                  </h4>
                                  <div className="space-y-3.5 pl-3 border-l-2 border-border/60">
                                    {problem.history.map((rev) => {
                                      let ratingColor = 'text-green-500 bg-green-500/10 border-green-500/20';
                                      if (rev.rating === 'Blank') ratingColor = 'text-destructive bg-destructive/10 border-destructive/20';
                                      if (rev.rating === 'Shaky') ratingColor = 'text-amber-500 bg-amber-500/10 border-amber-500/20';

                                      return (
                                        <div key={rev.reviewId} className="relative pl-4 text-xs space-y-1.5">
                                          {/* bullet */}
                                          <div className="absolute -left-[17px] top-1.5 w-1.5 h-1.5 rounded-full bg-border border border-background" />
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-semibold text-muted-foreground">
                                              {formatDate(rev.reviewedAt)}
                                            </span>
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${ratingColor}`}>
                                              {rev.rating === 'GotIt' ? 'Got It' : rev.rating}
                                            </span>
                                            {rev.failureReason && (
                                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-destructive/5 text-destructive border border-destructive/10">
                                                Mistake: {rev.failureReason}
                                              </span>
                                            )}
                                          </div>
                                          {rev.sketch && (
                                            <div className="p-2.5 rounded-xl bg-background border border-border/40 font-mono text-[10px] text-muted-foreground whitespace-pre-wrap max-w-xl leading-relaxed">
                                              {rev.sketch}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
