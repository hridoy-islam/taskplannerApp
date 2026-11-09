import { useMemo } from 'react';

import { useAppSelector } from '@/hooks/use-redux';
import { resolveImageUrl } from '@/lib/image-url';

export type CurrentUser = {
  _id?: string;
  name?: string;
  email?: string;
  role?: string;
  phone?: string;
  address?: string;
  /** Loadable image URL (already resolved against the API). */
  image?: string;
};

/**
 * The signed-in user: login token data merged with the fetched profile
 * (which holds fields the token doesn't, like `image` and `phone`).
 */
export function useCurrentUser(): CurrentUser | null {
  const authUser = useAppSelector((state) => state.auth.user);
  const profile = useAppSelector((state) => state.profile.profileData) as
    | (Record<string, any> & { _id?: string })
    | null;

  return useMemo(() => {
    if (!authUser) return null;
    // Ignore a profile left over from a different account.
    const sameUser = profile && (!profile._id || profile._id === authUser._id);
    const merged = sameUser ? { ...authUser, ...profile } : authUser;
    return { ...merged, image: resolveImageUrl(merged.image) };
  }, [authUser, profile]);
}
