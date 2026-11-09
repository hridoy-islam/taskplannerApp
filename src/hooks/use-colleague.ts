import { useEffect, useState } from 'react';

import { useAppSelector } from '@/hooks/use-redux';
import axiosInstance from '@/lib/axios';
import type { Colleague } from '@/redux/features/colleaguesSlice';

/** Looks up a colleague from the loaded list, falling back to the API. */
export function useColleague(id?: string) {
  const fromList = useAppSelector((state) => state.colleagues.users.find((u) => u._id === id));
  const [fetched, setFetched] = useState<Colleague | null>(null);

  useEffect(() => {
    if (!id || fromList) return;
    let active = true;
    axiosInstance
      .get(`/users/${id}`)
      .then((res) => active && setFetched(res.data?.data ?? null))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id, fromList]);

  return fromList ?? fetched;
}
