'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestOtpAction, verifyOtpAction } from '../actions/authActions';
import { Sparkles, ArrowRight, CheckCircle, Loader } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    const res = await requestOtpAction(email);
    setLoading(false);

    if (res.success) {
      setStep('code');
      setSuccess(`A 6-digit verification code has been sent. Check your server/email log!`);
    } else {
      setError(res.error || 'Something went wrong.');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;

    setLoading(true);
    setError(null);

    const res = await verifyOtpAction(email, code);
    setLoading(false);

    if (res.success) {
      router.push('/');
      router.refresh();
    } else {
      setError(res.error || 'Invalid verification code.');
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-12 sm:px-6 lg:px-8 bg-gradient-to-br from-background via-card/50 to-background">
      <div className="w-full max-w-md space-y-8">
        {/* Header Branding */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/10 text-primary mb-4 animate-pulse">
            <Sparkles className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-muted-foreground to-foreground bg-clip-text text-transparent">
            Recall
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">
            The minimalist spaced repetition layer for your LeetCode notes.
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-card border border-border shadow-2xl rounded-3xl p-8 backdrop-blur-md relative overflow-hidden transition-all duration-300">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-destructive/10 text-destructive text-sm font-medium border border-destructive/20 animate-fade-in">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 text-sm font-medium border border-green-500/20 flex items-start gap-2 animate-fade-in">
              <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {step === 'email' ? (
            <form onSubmit={handleSendOtp} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-primary-foreground bg-primary hover:opacity-90 font-semibold shadow-lg shadow-primary/20 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                {loading ? (
                  <Loader className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Continue with Email
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="code" className="block text-sm font-medium text-foreground">
                    Verification Code
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('email');
                      setError(null);
                      setSuccess(null);
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Change Email
                  </button>
                </div>
                <input
                  id="code"
                  type="text"
                  required
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={loading}
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground text-center tracking-widest text-lg font-bold placeholder-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                />
              </div>

              <button
                type="submit"
                disabled={loading || code.length < 6}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-primary-foreground bg-primary hover:opacity-90 font-semibold shadow-lg shadow-primary/20 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                {loading ? (
                  <Loader className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Verify & Access Recall
                    <CheckCircle className="h-5 w-5" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-muted-foreground">
          Recall is designed for daily LeetCode consistency. No password required.
        </p>
      </div>
    </div>
  );
}
