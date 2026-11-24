/**
 * Real sign-in: Firebase Authentication (Google, or email + password) → POST /auth/session on
 * jomarKhata-be, which creates the account on first login and returns it.
 *
 * - The Firebase SDK is loaded with dynamic import() ONLY when the user signs in or the app needs a
 *   token, so it is not part of the /app start-up code (offline-first, light).
 * - Turned on when NEXT_PUBLIC_FIREBASE_* and NEXT_PUBLIC_API_URL are set; otherwise the app uses
 *   `noBackendAuthProvider` and says honestly that login isn't available.
 */
import { API_URL, apiFetch } from './api';
import { authFromSession, noBackendAuthProvider, type AuthProvider, type AuthState, type AuthUser, type SignUpOptions } from './auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
};

export const loginConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId && API_URL);

async function firebaseAuth() {
  const [{ initializeApp, getApps }, authMod] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
  const app = getApps()[0] ?? initializeApp(firebaseConfig);
  const auth = authMod.getAuth(app);
  auth.languageCode = 'bn';
  return { auth, authMod };
}

/** Bangla messages for the Firebase errors people actually hit. */
function friendly(err: unknown): Error {
  const code = (err as { code?: string }).code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-credential': 'ইমেইল বা পাসওয়ার্ড ঠিক নেই।',
    'auth/wrong-password': 'পাসওয়ার্ড ঠিক নেই।',
    'auth/user-not-found': 'এই ইমেইলে কোনো অ্যাকাউন্ট নেই। নতুন অ্যাকাউন্ট খুলুন।',
    'auth/email-already-in-use': 'এই ইমেইলে আগেই অ্যাকাউন্ট আছে। লগইন করুন।',
    'auth/invalid-email': 'ইমেইল ঠিকভাবে লিখুন।',
    'auth/weak-password': 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের দিন।',
    'auth/too-many-requests': 'অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।',
    'auth/network-request-failed': 'ইন্টারনেট সংযোগ নেই। নেট চালু করে আবার চেষ্টা করুন।',
    'auth/popup-closed-by-user': 'Google লগইন বন্ধ করা হয়েছে।',
  };
  if (map[code]) return new Error(map[code]);
  return err instanceof Error ? err : new Error('লগইন করা যায়নি।');
}

interface SessionResponse {
  user: AuthUser;
  created: boolean;
  referralAccepted: boolean | null;
  serverTime: string;
}

/** Firebase user → backend session (creates the account on first login). */
async function openSession(getIdToken: () => Promise<string>, options?: SignUpOptions): Promise<AuthState> {
  const token = await getIdToken();
  const res = await apiFetch<SessionResponse>('/auth/session', { token, body: { referralCode: options?.referralCode } });
  return authFromSession({ ...res.user, isNewAccount: res.created, serverTime: res.serverTime });
}

/** One-time: add a referral code after sign-up (server allows it once, within 7 days). */
export async function addReferral(referralCode: string): Promise<AuthState> {
  const token = await currentIdToken();
  if (!token) throw new Error('লগইন করুন।');
  const res = await apiFetch<{ user: AuthUser; serverTime: string }>('/me/referral', { token, body: { referralCode } });
  return authFromSession({ ...res.user, serverTime: res.serverTime });
}

/** Current Firebase ID token for API calls (waits for Firebase to restore the sign-in). null = signed out. */
export async function currentIdToken(): Promise<string | null> {
  if (!loginConfigured) return null;
  const { auth, authMod } = await firebaseAuth();
  const user =
    auth.currentUser ??
    (await new Promise<import('firebase/auth').User | null>((resolve) => {
      const off = authMod.onAuthStateChanged(auth, (u) => {
        off();
        resolve(u);
      });
    }));
  return user ? user.getIdToken() : null;
}

/**
 * Online refresh of the signed-in account (subscription, referral numbers). Returns null when
 * offline, not signed in to Firebase on this device, or the server can't be reached — the cached
 * session keeps working (offline-first).
 */
export async function refreshSession(): Promise<AuthState | null> {
  if (!loginConfigured || typeof navigator === 'undefined' || !navigator.onLine) return null;
  try {
    const { auth, authMod } = await firebaseAuth();
    const user = auth.currentUser ?? (await new Promise<import('firebase/auth').User | null>((resolve) => {
      const off = authMod.onAuthStateChanged(auth, (u) => {
        off();
        resolve(u);
      });
    }));
    if (!user) return null;
    const res = await apiFetch<{ user: AuthUser; serverTime: string }>('/me', { token: await user.getIdToken() });
    return authFromSession({ ...res.user, serverTime: res.serverTime });
  } catch {
    return null;
  }
}

export const firebaseAuthProvider: AuthProvider = {
  available: true,
  async signInWithGoogle(options) {
    const { auth, authMod } = await firebaseAuth();
    const provider = new authMod.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const cred = await authMod.signInWithPopup(auth, provider);
      return await openSession(() => cred.user.getIdToken(), options);
    } catch (err) {
      throw friendly(err);
    }
  },
  async signInWithEmail(email, password) {
    const { auth, authMod } = await firebaseAuth();
    try {
      const cred = await authMod.signInWithEmailAndPassword(auth, email.trim(), password);
      return await openSession(() => cred.user.getIdToken());
    } catch (err) {
      throw friendly(err);
    }
  },
  async signUpWithEmail(email, password, options) {
    const { auth, authMod } = await firebaseAuth();
    try {
      const cred = await authMod.createUserWithEmailAndPassword(auth, email.trim(), password);
      void authMod.sendEmailVerification(cred.user).catch(() => {});
      return await openSession(() => cred.user.getIdToken(), options);
    } catch (err) {
      throw friendly(err);
    }
  },
  async sendPasswordReset(email) {
    const { auth, authMod } = await firebaseAuth();
    try {
      await authMod.sendPasswordResetEmail(auth, email.trim());
    } catch (err) {
      throw friendly(err);
    }
  },
  async signOut() {
    const { auth, authMod } = await firebaseAuth();
    await authMod.signOut(auth);
  },
};

/** The provider the app uses. */
export const authProvider: AuthProvider = loginConfigured ? firebaseAuthProvider : noBackendAuthProvider;
