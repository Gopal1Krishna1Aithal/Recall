import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getTodayQueueAction } from './actions/problemActions';
import Header from '@/components/Header';
import TodayQueue from '@/components/TodayQueue';

export const revalidate = 0; // Disable static cache for dynamic revision queue

export default async function TodayPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  // Fetch initial queue of problems due today or earlier
  const initialQueue = await getTodayQueueAction();

  // Convert Date objects to strings for Client Component serialization
  const serializedQueue = initialQueue.map((item) => ({
    ...item,
    nextDue: item.nextDue.toISOString(),
  }));

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8">
        <TodayQueue initialQueue={serializedQueue} />
      </main>
    </div>
  );
}
