import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/db';
import Header from '@/components/Header';
import CheatSheetClient from './CheatSheetClient';

export const revalidate = 0; // Disable static cache

export default async function CheatSheetPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  // Fetch all problems for the user to compile the cheat sheet
  const problems = await prisma.problemLog.findMany({
    where: {
      userId: session.userId,
    },
    orderBy: {
      title: 'asc',
    },
  });

  return (
    <div className="min-h-screen flex flex-col bg-background print:bg-white print:text-black">
      {/* Hide Header on print */}
      <div className="print:hidden">
        <Header />
      </div>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 print:p-0 print:max-w-full">
        <CheatSheetClient initialProblems={problems} />
      </main>
    </div>
  );
}
