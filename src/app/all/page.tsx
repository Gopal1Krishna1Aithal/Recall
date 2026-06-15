import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getAllProblemsAction } from '../actions/problemActions';
import Header from '@/components/Header';
import AllProblemsTable from '@/components/AllProblemsTable';

export const revalidate = 0; // Disable static cache for dynamic problem listing

export default async function AllProblemsPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  // Fetch all logged problems for the current user
  const problems = await getAllProblemsAction();

  // Convert Date objects to strings for Client Component serialization
  const serializedProblems = problems.map((item) => ({
    ...item,
    nextDue: item.nextDue.toISOString(),
  }));

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8">
        <AllProblemsTable initialProblems={serializedProblems} />
      </main>
    </div>
  );
}
