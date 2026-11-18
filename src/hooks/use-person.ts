import { useCallback, useEffect } from 'react';

import { useCurrentUser } from '@/hooks/use-current-user';
import { useAppDispatch, useAppSelector } from '@/hooks/use-redux';
import { resolveImageUrl } from '@/lib/image-url';
import { type Ref, refId, refName } from '@/lib/tasks';
import { fetchColleagues } from '@/redux/features/colleaguesSlice';

export type Person = { id?: string; name?: string; image?: string };

/** Only ask for the colleague list once per signed-in user, however many cards mount at once. */
let requestedFor: string | undefined;

/**
 * Returns a function that turns a task's author / assignee into a name and a loadable photo.
 * Tasks often carry only an id, or a name without the image, so this falls back to the signed-in
 * user's profile and then the colleague list (loaded here if it isn't yet).
 */
export function usePersonResolver() {
  const dispatch = useAppDispatch();
  const me = useCurrentUser();
  const colleagues = useAppSelector((state) => state.colleagues.users);

  useEffect(() => {
    if (!me?._id || colleagues.length > 0 || requestedFor === me._id) return;
    requestedFor = me._id;
    dispatch(fetchColleagues(me._id));
  }, [me?._id, colleagues.length, dispatch]);

  return useCallback(
    (ref: Ref): Person | undefined => {
      const id = refId(ref);
      const own = typeof ref === 'object' && ref ? ref : undefined;
      const known = id === me?._id ? me : colleagues.find((u) => u._id === id);
      const name = refName(ref) ?? known?.name;
      if (!id && !name) return undefined;
      return {
        id,
        name,
        // The task's own image first, then the profile / colleague one.
        image: resolveImageUrl(own?.image) ?? resolveImageUrl(known?.image),
      };
    },
    [me, colleagues]
  );
}
