import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthLayout, Subtitle } from '@/components/auth/auth-layout';
import { OtpInput } from '@/components/auth/otp-input';
import { Button } from '@/components/ui/button';
import { Brand } from '@/constants/theme';
import { useAppDispatch } from '@/hooks/use-redux';
import { getErrorMessage } from '@/lib/auth-errors';
import { requestOtp, validateRequestOtp } from '@/redux/features/authSlice';

const OTP_LENGTH = 4;
const RESEND_SECONDS = 30;

export default function VerifyOtpScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleVerify = async () => {
    if (otp.length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH} digit code`);
      return;
    }
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      const res = await dispatch(validateRequestOtp({ email, otp })).unwrap();
      const token = (res.data as { resetToken?: string } | undefined)?.resetToken;
      if (!token) {
        setError('Could not start password reset. Please try again.');
        return;
      }
      router.replace({ pathname: '/(public)/reset-password', params: { token } });
    } catch (err) {
      setError(getErrorMessage(err, 'That code is not valid.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError(null);
    try {
      await dispatch(requestOtp({ email })).unwrap();
      setInfo('A new code has been sent.');
      setOtp('');
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not resend the code.'));
    }
  };

  return (
    <AuthLayout
      showBack
      title="Check Your Email"
      subtitle={
        <View style={styles.subtitle}>
          <Subtitle>We sent a {OTP_LENGTH} digit code to</Subtitle>
          <Text style={styles.email}>{email}</Text>
        </View>
      }
    >
      <OtpInput length={OTP_LENGTH} value={otp} onChange={setOtp} />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}

      <Button title="Verify" size="lg" onPress={handleVerify} loading={submitting} disabled={submitting} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Didn&apos;t get the OTP? </Text>
        <Pressable onPress={handleResend} disabled={cooldown > 0} hitSlop={8}>
          <Text style={[styles.link, cooldown > 0 && styles.linkDisabled]}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend'}
          </Text>
        </Pressable>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  subtitle: { alignItems: 'center' },
  email: { marginTop: 2, fontSize: 15, fontWeight: '700', color: Brand.text },
  error: { color: Brand.error, fontSize: 13, textAlign: 'center' },
  info: { color: Brand.textMuted, fontSize: 13, textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  footerText: { fontSize: 13, color: Brand.text },
  link: { fontSize: 13, fontWeight: '600', color: Brand.link },
  linkDisabled: { color: Brand.placeholder },
});
