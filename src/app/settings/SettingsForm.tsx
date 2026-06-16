'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { logoutAction } from '../actions/authActions';
import { saveLeetcodeUsernameAction, getRevisionHeatmapAction, getLeetcodeVerificationCodeAction } from '../actions/problemActions';
import ThemeToggle from '@/components/ThemeToggle';
import { LogOut, User, Moon, Shield, AlertTriangle, Check, Loader, Link2, BookOpen, Printer, Calendar } from 'lucide-react';

import Link from 'next/link';

interface AnalyticsItem {
  reason: string;
  count: number;
  percentage: number;
}

interface SettingsFormProps {
  email: string;
  initialLeetcodeUsername: string;
  initialAnalytics: AnalyticsItem[];
  initialAnalyticsTotal: number;
  initialHeatmap: Record<string, number>;
}

export default function SettingsForm({ 
  email, 
  initialLeetcodeUsername,
  initialAnalytics,
  initialAnalyticsTotal,
  initialHeatmap
}: SettingsFormProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  // LeetCode Username State
  const [username, setUsername] = useState(initialLeetcodeUsername);
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameMessage, setUsernameMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleLogout = async () => {
    setLoggingOut(true);
    const res = await logoutAction();
    if (res.success) {
      router.push('/login');
      router.refresh();
    } else {
      alert('Failed to log out.');
      setLoggingOut(false);
    }
  };

  const handleSaveUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingUsername(true);
    setUsernameMessage(null);
    
    const res = await saveLeetcodeUsernameAction(username);
    setSavingUsername(false);
    
    if (res.success) {
      setUsernameMessage({ type: 'success', text: res.username ? `Connected LeetCode username "${res.username}" successfully!` : 'LeetCode username saved successfully!' });
      router.refresh();
      setTimeout(() => setUsernameMessage(null), 3000);
    } else {
      setUsernameMessage({ type: 'error', text: res.error || 'Failed to save username.' });
    }
  };

  const [heatmap, setHeatmap] = useState<Record<string, number>>(initialHeatmap);
  const [verificationCode, setVerificationCode] = useState<string | null>(null);

  useEffect(() => {
    const fetchHeatmap = async () => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await getRevisionHeatmapAction(tz);
      if (res.success && res.heatmap) {
        setHeatmap(res.heatmap);
      }
    };
    const fetchVerificationCode = async () => {
      const res = await getLeetcodeVerificationCodeAction();
      if (res.success && res.code) {
        setVerificationCode(res.code);
      }
    };
    fetchHeatmap();
    fetchVerificationCode();
  }, []);

  // Generate date array for the 16-week grid (112 days)
  const getGridDates = () => {
    const dates: { dateStr: string; date: Date; count: number }[] = [];
    const endDate = new Date();
    const currentDay = endDate.getDay();
    const daysToSaturday = 6 - currentDay;
    endDate.setDate(endDate.getDate() + daysToSaturday);
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 16 * 7 + 1);
    startDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < 112; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const date = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${date}`;
      
      dates.push({
        dateStr,
        date: d,
        count: heatmap[dateStr] || 0,
      });
    }
    return dates;
  };

  const gridDates = getGridDates();


  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Settings</h2>
        <p className="text-xs text-muted-foreground">Manage profile connections, analytics, and preferences.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-md divide-y divide-border/60 overflow-hidden">
        {/* Dark Mode Row */}
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Moon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Dark Theme</h3>
              <p className="text-xs text-muted-foreground">Toggle between light and dark modes.</p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {/* LeetCode Sync Setup */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Link2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">LeetCode Account Connection</h3>
              <p className="text-xs text-muted-foreground">Sync your recent accepted submissions automatically.</p>
            </div>
          </div>
          
          <form onSubmit={handleSaveUsername} className="space-y-4">
            {verificationCode && (
              <div className="bg-muted/50 border border-border/60 rounded-2xl p-4 space-y-2.5 text-xs">
                <p className="font-bold text-foreground flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  Account Ownership Verification Required
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  To prevent unauthorized connections, please add this unique verification code to your LeetCode profile <strong>Bio / "About Me"</strong> section:
                </p>
                <div className="flex items-center gap-2 bg-background border border-border/60 p-2 rounded-xl">
                  <code className="text-primary font-mono font-bold select-all tracking-wider flex-1 text-xs px-2">{verificationCode}</code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(verificationCode);
                      alert('Verification code copied to clipboard!');
                    }}
                    className="px-2.5 py-1 bg-muted hover:bg-muted/80 rounded-lg font-bold text-[10px] text-muted-foreground cursor-pointer transition-all active:scale-95 border border-border/40"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground/80 italic">
                  Note: You can safely remove this code from your profile bio after your account connection has been verified and saved.
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Enter LeetCode profile URL or username (e.g. leetcode.com/u/gopal)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-input bg-background text-foreground placeholder-muted-foreground/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
              <button
                type="submit"
                disabled={savingUsername}
                className="shrink-0 px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-95 shadow-md shadow-primary/10 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {savingUsername ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Save Connection
              </button>
            </div>

            {usernameMessage && (
              <div 
                className={`p-3 rounded-lg text-xs font-semibold border ${
                  usernameMessage.type === 'success' 
                    ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400' 
                    : 'bg-destructive/10 border-destructive/20 text-destructive'
                }`}
              >
                {usernameMessage.text}
              </div>
            )}
          </form>
        </div>

        {/* Weakness Detector Analytics */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Weakness Detector Analytics</h3>
              <p className="text-xs text-muted-foreground">Understand where your solutions break down during self-tests.</p>
            </div>
          </div>

          {initialAnalyticsTotal === 0 ? (
            <div className="bg-muted/30 p-4 rounded-xl border border-border/40 text-center text-xs text-muted-foreground">
              No mistakes logged yet. Select a mistake reason when rating cards to populate your weakness graph.
            </div>
          ) : (
            <div className="space-y-4 bg-muted/20 p-5 rounded-2xl border border-border/40 shadow-inner">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-foreground">Error Classification Distribution</span>
                <span className="text-muted-foreground font-medium">{initialAnalyticsTotal} Failures Analyzed</span>
              </div>
              
              <div className="space-y-3.5">
                {initialAnalytics.map((item) => {
                  let barColor = 'bg-primary';
                  if (item.reason === 'Bug') barColor = 'bg-rose-500 dark:bg-rose-600';
                  if (item.reason === 'Corner Case') barColor = 'bg-amber-500 dark:bg-amber-600';
                  if (item.reason === 'Efficiency') barColor = 'bg-sky-500 dark:bg-sky-600';
                  if (item.reason === 'Pattern') barColor = 'bg-violet-500 dark:bg-violet-600';

                  return (
                    <div key={item.reason} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-foreground">{item.reason}</span>
                        <span className="text-muted-foreground">{item.count} ({item.percentage}%)</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-muted border border-border/10 overflow-hidden">
                        <div 
                          className={`h-full ${barColor} rounded-full transition-all duration-500 ease-out`}
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {initialAnalytics.length > 0 && (
                <div className="mt-4 p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-xs text-amber-600 dark:text-amber-400 font-medium leading-relaxed">
                  💡 <strong>Revision Focus:</strong> Your primary coding weakness is{' '}
                  <strong className="underline decoration-wavy font-bold">{initialAnalytics[0].reason}</strong>, accounting for{' '}
                  {initialAnalytics[0].percentage}% of all failures. Focus on code verification in this area today!
                </div>
              )}
            </div>
          )}
        </div>

        {/* Revision Consistency Heatmap */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Revision Consistency Heatmap</h3>
              <p className="text-xs text-muted-foreground">Track your revision habit consistency over the last 16 weeks.</p>
            </div>
          </div>

          <div className="flex gap-3 p-5 bg-muted/20 border border-border/40 rounded-2xl shadow-inner overflow-hidden">
            {/* Day labels */}
            <div className="flex flex-col justify-between text-[10px] text-muted-foreground font-semibold py-1.5 select-none h-28 pr-1 border-r border-border/10 shrink-0">
              <span>Sun</span>
              <span>Tue</span>
              <span>Thu</span>
              <span>Sat</span>
            </div>
            
            {/* Grid container */}
            <div className="flex-1 min-w-0">
              <div className="grid grid-rows-7 grid-flow-col gap-1 overflow-x-auto pb-2 select-none h-28">
                {gridDates.map((cell) => {
                  let colorClass = 'bg-muted border border-border/10';
                  if (cell.count === 1) colorClass = 'bg-primary/20 text-primary border border-primary/20';
                  else if (cell.count === 2) colorClass = 'bg-primary/45 text-primary border border-primary/20';
                  else if (cell.count === 3) colorClass = 'bg-primary/70 text-primary border border-primary/20';
                  else if (cell.count >= 4) colorClass = 'bg-primary text-primary-foreground border border-primary/20';

                  return (
                    <div 
                      key={cell.dateStr}
                      className={`w-3.5 h-3.5 rounded-sm transition-all hover:scale-125 hover:z-10 cursor-pointer relative group ${colorClass}`}
                    >
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-popover border border-border rounded text-[10px] text-popover-foreground whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-md">
                        {cell.count} review{cell.count !== 1 ? 's' : ''} on {cell.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium pt-2 select-none">
                <span>16 Weeks Ago</span>
                <div className="flex items-center gap-1">
                  <span>Less</span>
                  <div className="w-2.5 h-2.5 rounded-sm bg-muted border border-border/10" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-primary/20 border border-primary/20" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-primary/45 border border-primary/20" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-primary/70 border border-primary/20" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-primary border border-primary/20" />
                  <span>More</span>
                </div>
                <span>Today</span>
              </div>
            </div>
          </div>
        </div>

        {/* Study Tools / Cheat Sheet */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Interview Study Guide</h3>
              <p className="text-xs text-muted-foreground">Print or compile your notes as a PDF study sheet.</p>
            </div>
          </div>
          <div className="flex justify-start">
            <Link
              href="/cheat-sheet"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary transition-all cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              Generate Study Guide
            </Link>
          </div>
        </div>

        {/* Account Profile Row */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Account Profile</h3>
              <p className="text-xs text-muted-foreground">Logged in user email address.</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-muted/40 p-4 rounded-xl border border-border/40">
            <span className="text-sm font-semibold text-foreground truncate max-w-full">
              {email}
            </span>
            <span className="shrink-0 text-xs px-2.5 py-0.5 rounded-full font-bold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Active Session
            </span>
          </div>
        </div>

        {/* Log Out Row */}
        <div className="p-6 flex justify-end">
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-destructive/20 hover:bg-destructive/10 text-destructive transition-all cursor-pointer disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            {loggingOut ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      </div>
    </div>
  );
}
