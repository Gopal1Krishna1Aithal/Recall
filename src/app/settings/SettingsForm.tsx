'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { logoutAction } from '../actions/authActions';
import ThemeToggle from '@/components/ThemeToggle';
import { LogOut, User, Moon, Shield } from 'lucide-react';

interface SettingsFormProps {
  email: string;
}

export default function SettingsForm({ email }: SettingsFormProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Settings</h2>
        <p className="text-xs text-muted-foreground">Manage theme preferences and account details.</p>
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

        {/* Account Row */}
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
