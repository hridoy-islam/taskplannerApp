import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthLayout } from '@/components/auth/auth-layout';
import { OtpInput } from '@/components/auth/otp-input';
import { OnboardingLogoutButton } from '@/components/onboarding/logout-button';
import { Button } from '@/components/ui/button';
import { Brand } from '@/constants/theme';
import { useAppDispatch, useAppSelector } from '@/hooks/use-redux';
import { getErrorMessage } from '@/lib/auth-errors';
import { resendOtp, verifyEmail } from '@/redux/features/authSlice';

const OTP_LENGTH = 4;
const RESEND_SECONDS = 30;

/**
 * Email verification for a signed-in user whose account isn't verified yet (website: /not-verified).
 * The API emails the code when such a user logs in; "Resend" sends a new one.
 */
export default function VerifyEmailScreen() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const email: string = user?.email ?? '';
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

  // Verified (here or elsewhere): "/" routes on to the next step or into the app.
  if (user?.isValided) return <Redirect href="/" />;

  const handleVerify = async () => {
    if (otp.length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH} digit code`);
      return;
    }
    if (!email) {
      setError('Email missing. Please log out and log in again.');
      return;
    }
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      await dispatch(verifyEmail({ email, otp })).unwrap();
      // The redirect above takes over once isValided is set.
    } catch (err) {
      setError(getErrorMessage(err, 'That code is not valid.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || !email) return;
    setError(null);
    try {
      await dispatch(resendOtp({ email })).unwrap();
      setInfo('A new code has been sent.');
      setOtp('');
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not resend the code.'));
    }
  };

  return (
    <View style={styles.flex}>
      <AuthLayout
        title="Verify Your Email"
        subtitle={
          <View style={styles.subtitle}>
            <Text style={styles.subtitleText}>A verification code has been sent to</Text>
            <Text style={styles.email}>{email}</Text>
            <Text style={[styles.subtitleText, styles.hint]}>
              Check your inbox and enter the code below to verify your email address.
            </Text>
          </View>
        }
      >
        <OtpInput length={OTP_LENGTH} value={otp} onChange={setOtp} />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {info ? <Text style={styles.info}>{info}</Text> : null}

        <Button title="Verify" size="lg" onPress={handleVerify} loading={submitting} disabled={submitting} />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Didn&apos;t get the code? </Text>
          <Pressable onPress={handleResend} disabled={cooldown > 0} hitSlop={8}>
            <Text style={[styles.link, cooldown > 0 && styles.linkDisabled]}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend'}
            </Text>
          </Pressable>
        </View>
      </AuthLayout>

      {/* Over the layout's empty back-button row, top right. */}
      <SafeAreaView edges={['top']} style={styles.logout} pointerEvents="box-none">
        <OnboardingLogoutButton />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  subtitle: { alignItems: 'center' },
  subtitleText: { fontSize: 13, lineHeight: 18, color: Brand.text, textAlign: 'center' },
  hint: { marginTop: 8 },
  email: { marginTop: 2, fontSize: 15, fontWeight: '700', color: Brand.text },
  error: { color: Brand.error, fontSize: 13, textAlign: 'center' },
  info: { color: Brand.text, fontSize: 13, textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  footerText: { fontSize: 13, color: Brand.text },
  link: { fontSize: 13, fontWeight: '600', color: Brand.link },
  linkDisabled: { color: Brand.placeholder },
  logout: { position: 'absolute', top: 8, right: 20 },
});
