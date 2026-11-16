import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { jwtDecode } from 'jwt-decode';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';

import { AuthField } from '@/components/auth/auth-field';
import { AuthLayout, Subtitle } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Brand } from '@/constants/theme';
import { useAppDispatch } from '@/hooks/use-redux';
import { getErrorMessage } from '@/lib/auth-errors';
import { changePassword } from '@/redux/features/authSlice';

const MIN_PASSWORD_LENGTH = 6;

type Errors = { password?: string; confirmPassword?: string };

export default function ResetPasswordScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { token = '' } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const confirmRef = useRef<TextInput>(null);

  // The reset token from the OTP step carries the user's id.
  const userId = useMemo(() => {
    try {
      return jwtDecode<{ _id?: string }>(token)._id ?? '';
    } catch {
      return '';
    }
  }, [token]);

  if (!userId) {
    return <Redirect href="/(public)/forgot-password" />;
  }

  const handleSubmit = async () => {
    const next: Errors = {};
    if (password.length < MIN_PASSWORD_LENGTH) {
      next.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }
    if (confirmPassword !== password) {
      next.confirmPassword = 'Passwords do not match';
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setFormError(null);
    setSubmitting(true);
    try {
      await dispatch(changePassword({ userId, token, password })).unwrap();
      router.replace('/(public)/login');
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not reset your password.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      showBack
      title="New Password"
      subtitle={<Subtitle>Create a new password for your account.</Subtitle>}
    >
      <AuthField
        label="New Password"
        password
        value={password}
        onChangeText={setPassword}
        placeholder="Enter new password"
        autoComplete="new-password"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        error={errors.password}
      />

      <AuthField
        ref={confirmRef}
        label="Confirm Password"
        password
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Re-enter new password"
        autoComplete="new-password"
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
        error={errors.confirmPassword}
      />

      {formError ? <Text style={styles.error}>{formError}</Text> : null}

      <Button title="Submit" size="lg" onPress={handleSubmit} loading={submitting} disabled={submitting} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  error: { color: Brand.error, fontSize: 13, textAlign: 'center' },
});
