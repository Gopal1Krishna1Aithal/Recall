'use server';

import { sendOtp, verifyOtp, setSession, clearSession } from '@/lib/auth';
import prisma from '@/lib/db';

/**
 * Initiates the passwordless OTP sign-in process.
 */
export async function requestOtpAction(email: string) {
  if (!email || !email.includes('@')) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  try {
    const sanitizedEmail = email.trim().toLowerCase();
    await sendOtp(sanitizedEmail);
    return { success: true };
  } catch (error) {
    console.error('Error in requestOtpAction:', error);
    return { success: false, error: 'Failed to send verification code. Please try again.' };
  }
}

/**
 * Verifies the OTP code and logs the user in.
 */
export async function verifyOtpAction(email: string, code: string) {
  if (!email || !code) {
    return { success: false, error: 'Email and verification code are required.' };
  }

  try {
    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedCode = code.trim();

    const isVerified = await verifyOtp(sanitizedEmail, sanitizedCode);
    if (!isVerified) {
      return { success: false, error: 'Invalid or expired verification code.' };
    }

    // Upsert the user in the database
    let user = await prisma.user.findUnique({
      where: { email: sanitizedEmail },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { email: sanitizedEmail },
      });
    }

    // Set the session cookie
    await setSession(user.userId, user.email);

    return { success: true };
  } catch (error) {
    console.error('Error in verifyOtpAction:', error);
    return { success: false, error: 'An error occurred during verification.' };
  }
}

/**
 * Logs the current user out.
 */
export async function logoutAction() {
  try {
    await clearSession();
    return { success: true };
  } catch (error) {
    console.error('Error in logoutAction:', error);
    return { success: false, error: 'Failed to log out.' };
  }
}
