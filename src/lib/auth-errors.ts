/** Pulls a readable message out of a rejected thunk / axios error. */
export function getErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  const e = err as any;
  return e?.message || e?.response?.data?.message || e?.data?.message || fallback;
}

export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
