import { cookies } from 'next/headers';
import prisma from './db';

const SESSION_COOKIE_NAME = 'recall_session';
const OTP_COOKIE_NAME = 'recall_otp';
const JWT_SECRET = process.env.AUTH_SECRET || 'dev-secret-key-at-least-32-chars-long-recall';

export interface SessionPayload {
  userId: string;
  email: string;
  exp: number;
}

export interface OtpPayload {
  email: string;
  code: string;
  exp: number;
}

// Simple HMAC signing using native Web Crypto API
async function sign(payload: any, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const payloadStr = JSON.stringify(payload);
  const data = encoder.encode(payloadStr);
  const keyData = encoder.encode(secret);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, data);
  const payloadBase64 = Buffer.from(payloadStr).toString('base64url');
  const signatureBase64 = Buffer.from(signature).toString('base64url');

  return `${payloadBase64}.${signatureBase64}`;
}

async function verify(token: string, secret: string): Promise<any | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadBase64, signatureBase64] = parts;
    const payloadStr = Buffer.from(payloadBase64, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadStr);

    // Check expiration
    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payload));
    const keyData = encoder.encode(secret);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signature = Buffer.from(signatureBase64, 'base64url');
    const isValid = await crypto.subtle.verify('HMAC', key, signature, data);

    return isValid ? payload : null;
  } catch (e) {
    return null;
  }
}

/**
 * Retrieves the current user session from the secure cookie.
 */
export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(SESSION_COOKIE_NAME);
    if (!cookie || !cookie.value) return null;

    return await verify(cookie.value, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Sets a secure session cookie for the user.
 */
export async function setSession(userId: string, email: string) {
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  const payload: SessionPayload = { userId, email, exp };
  const token = await sign(payload, JWT_SECRET);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(exp),
    path: '/',
  });
}

/**
 * Clears the session cookie (logs out the user).
 */
export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(0),
    path: '/',
  });
}

/**
 * Generates and stores a short-lived OTP token in a secure cookie.
 * Prints OTP to console in development.
 */
export async function sendOtp(email: string): Promise<string> {
  // Generate 6-digit random code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const exp = Date.now() + 5 * 60 * 1000; // 5 minutes validity

  const payload: OtpPayload = { email, code, exp };
  const token = await sign(payload, JWT_SECRET);

  const cookieStore = await cookies();
  cookieStore.set(OTP_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(exp),
    path: '/',
  });

  // LOCAL TESTING / LOGGING ADVANTAGE
  console.log('\n-----------------------------------------------');
  console.log(`[AUTH SYSTEM] OTP code for ${email} is: ${code}`);
  console.log('-----------------------------------------------\n');

  return code;
}

/**
 * Verifies the submitted OTP code.
 */
export async function verifyOtp(email: string, code: string): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(OTP_COOKIE_NAME);
    if (!cookie || !cookie.value) return false;

    const payload: OtpPayload | null = await verify(cookie.value, JWT_SECRET);
    if (!payload) return false;

    // Check email match and code match
    const emailMatch = payload.email.toLowerCase() === email.toLowerCase();
    const codeMatch = payload.code === code;

    if (emailMatch && codeMatch) {
      // Clear OTP cookie after successful use
      cookieStore.set(OTP_COOKIE_NAME, '', {
        httpOnly: true,
        expires: new Date(0),
        path: '/',
      });
      return true;
    }

    return false;
  } catch (e) {
    return false;
  }
}
