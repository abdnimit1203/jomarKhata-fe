/**
 * Auth interface (S10, plan §7.2). NO FAKE AUTHENTICATION:
 * - The auth state has exactly two shapes. Only `local` is reachable today.
 * - `authenticated` can only be produced by a real provider adapter (Firebase in the backend phase),
 *   and none exists yet. `NoBackendAuthProvider` refuses every sign-in honestly.
 */
export interface AuthUser {
  /** Server-generated, easy-to-read account ID for support, e.g. JK-4827-1935 (D29). Never a login credential. */
  accountId: string;
  email: string;
  displayName: string;
  phone?: string;
}

export type AuthState = { status: 'local' } | { status: 'authenticated'; user: AuthUser };

export class AuthUnavailableError extends Error {
  constructor() {
    super('অ্যাকাউন্ট ও লগইন এখনও চালু হয়নি। আপাতত আপনার হিসাব এই ফোনেই থাকবে।');
    this.name = 'AuthUnavailableError';
  }
}

export interface AuthProvider {
  readonly available: boolean;
  signInWithGoogle(): Promise<AuthState>;
  sendOtp(phone: string): Promise<{ requestId: string }>;
  verifyOtp(requestId: string, code: string): Promise<AuthState>;
  signOut(): Promise<void>;
}

/** Today's provider: there is no backend, so every sign-in is refused. */
export const noBackendAuthProvider: AuthProvider = {
  available: false,
  async signInWithGoogle() {
    throw new AuthUnavailableError();
  },
  async sendOtp() {
    throw new AuthUnavailableError();
  },
  async verifyOtp() {
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
