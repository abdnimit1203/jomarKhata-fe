/**
 * Auth interface. NO FAKE AUTHENTICATION:
 * - Two shapes: `local` (guest / test mode: the khata stays on this phone only) and `authenticated`.
 * - `authenticated` is produced ONLY from a real backend session (`authFromSession`), after Firebase
 *   sign-in and `POST /auth/session` (lib/auth-firebase.ts), or from that session cached on the phone.
 * - Without Firebase + API config, `noBackendAuthProvider` refuses every sign-in honestly.
 */
export interface AuthUser {
  /** Server-generated, easy-to-read account ID for support, e.g. JK-4827-1935 (D29). Never a login credential. */
  accountId: string;
  email: string;
  displayName: string;
  phone?: string;
  /** Profile photo (ImageKit). Missing or broken → initials. */
  avatarUrl?: string;
  role?: 'user' | 'super_admin';
  subscription?: { status: 'trial' | 'active' | 'expired'; plan?: string; expiresAt: string };
  /** No referrer yet and still inside the one-time 7-day window (server decides). */
  canAddReferral?: boolean;
  /** The account was created by this sign-in (shows the one-time referral step). */
  isNewAccount?: boolean;
  /** Server time when this record was fetched (clock-safe access policy). */
  serverTime?: string;
  /** Unique, server-generated code this user shares with others (see lib/referral.ts). */
  referralCode: string;
  /** Server-reported referral results; the app never calculates commission itself. */
  referralStats?: {
    referredUsers: number;
    /** promoter: cash commission; regular: free subscription time (BACKEND_CONTRACT §8). */
    referrerType?: 'regular' | 'promoter';
    commissionEarned: number;
    commissionRate?: number;
    freeDaysEarned?: number;
  };
}

/** Sign-up extras. The referral code is optional and only used when a NEW account is created. */
export interface SignUpOptions {
  referralCode?: string;
}

export type AuthState = { status: 'local' } | { status: 'authenticated'; user: AuthUser };

export class AuthUnavailableError extends Error {
  constructor() {
    super('অ্যাকাউন্ট ও লগইন এখনও চালু হয়নি। আপাতত আপনার হিসাব এই ফোনেই থাকবে।');
    this.name = 'AuthUnavailableError';
  }
}

/** Accounts are email-based (owner rule): Google, or email + password. */
export interface AuthProvider {
  readonly available: boolean;
  signInWithGoogle(options?: SignUpOptions): Promise<AuthState>;
  signInWithEmail(email: string, password: string): Promise<AuthState>;
  signUpWithEmail(email: string, password: string, options?: SignUpOptions): Promise<AuthState>;
  sendPasswordReset(email: string): Promise<void>;
  signOut(): Promise<void>;
}

/** The only way to build an authenticated state: from the backend's user record. */
export function authFromSession(user: AuthUser): AuthState {
  return { status: 'authenticated', user };
}

/** Used when Firebase / API settings are missing: every sign-in is refused. */
export const noBackendAuthProvider: AuthProvider = {
  available: false,
  async signInWithGoogle() {
    throw new AuthUnavailableError();
  },
  async signInWithEmail() {
    throw new AuthUnavailableError();
  },
  async signUpWithEmail() {
    throw new AuthUnavailableError();
  },
  async sendPasswordReset() {
    throw new AuthUnavailableError();
  },
  async signOut() {
    /* nothing to sign out of */
  },
};

export const LOCAL_AUTH: AuthState = { status: 'local' };

/** Bangladesh mobile: 01[3-9] + 8 digits; Bengali digits, spaces, dashes and +88 accepted. */
export function normalizeBdMobile(input: string): string | null {
  const ascii = input.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).replace(/[\s-]/g, '');
  const m = /^(?:\+?88)?(01[3-9]\d{8})$/.exec(ascii);
  return m ? m[1] : null;
}

/** Display format for an account ID (D29): JK-1234-5678. */
export function formatAccountId(digits: string): string {
  const d = digits.replace(/\D/g, '').padStart(8, '0').slice(-8);
  return `JK-${d.slice(0, 4)}-${d.slice(4)}`;
}
