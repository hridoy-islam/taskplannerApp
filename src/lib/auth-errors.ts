/** Pulls a readable message out of a rejected thunk / axios error. */
export function getErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  const e = err as any;
  return e?.message || e?.response?.data?.message || e?.data?.message || fallback;
}

export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

/**
 * Which field a server auth error is about, so it can be shown under that field
 * instead of as a general message: "Password do not matched" → password,
 * "User not found" / "Email already exists" → email.
 */
export function authErrorField(message: string): 'email' | 'password' | null {
  const m = message.toLowerCase();
  if (/password|credential/.test(m)) return 'password';
  if (/email|user|account|not found|not exist|does ?n.?t exist|already|registered|blocked|deleted/.test(m)) return 'email';
  return null;
}
