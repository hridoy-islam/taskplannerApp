import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { AuthField } from '@/components/auth/auth-field';
import { AuthLayout, Subtitle } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Brand } from '@/constants/theme';
import { useAppDispatch } from '@/hooks/use-redux';
import { getErrorMessage, isValidEmail } from '@/lib/auth-errors';
import { requestOtp } from '@/redux/features/authSlice';

export default function ForgotPasswordScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSend = async () => {
    if (!isValidEmail(email)) {
      setFieldError('Enter a valid email address');
      return;
    }
    setFieldError(undefined);
    setFormError(null);
    setSubmitting(true);
    try {
      await dispatch(requestOtp({ email: email.trim() })).unwrap();
      router.push({ pathname: '/(public)/verify-otp', params: { email: email.trim() } });
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not send the code.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      showBack
      title="Forgot Password"
      subtitle={
        <Subtitle>
          Don&apos;t worry! Please enter your email address.{'\n'}We&apos;ll send you a reset OTP.
        </Subtitle>
      }
    >
      <AuthField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        returnKeyType="send"
        onSubmitEditing={handleSend}
        error={fieldError}
      />

      {formError ? <Text style={styles.error}>{formError}</Text> : null}

      <Button title="Send" size="lg" onPress={handleSend} loading={submitting} disabled={submitting} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  error: { color: Brand.error, fontSize: 13, textAlign: 'center' },
});
