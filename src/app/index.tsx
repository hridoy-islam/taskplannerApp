import { Redirect } from 'expo-router';

import { useAppSelector } from '@/hooks/use-redux';

export default function Index() {
  const user = useAppSelector((state) => state.auth.user);

  return <Redirect href={user ? '/(private)/home' : '/(public)/login'} />;
}
