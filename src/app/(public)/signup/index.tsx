import { Link, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';

import { AuthField } from '@/components/auth/auth-field';
import { AuthLayout, Subtitle } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Brand } from '@/constants/theme';
import { useAppDispatch } from '@/hooks/use-redux';
import { getErrorMessage, isValidEmail } from '@/lib/auth-errors';
import { registerUser } from '@/redux/features/authSlice';

type Errors = Partial<Record<'name' | 'email' | 'phone' | 'password', string>>;

export default function SignupScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const handleSignup = async () => {
    const next: Errors = {};
    if (!name.trim()) next.name = 'Enter your name';
    if (!isValidEmail(email)) next.email = 'Enter a valid email address';
    if (phone.replace(/\D/g, '').length < 7) next.phone = 'Enter a valid phone number';
    if (password.length < 6) next.password = 'Password must be at least 6 characters';
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      await dispatch(
        registerUser({ name: name.trim(), email: email.trim(), phone: phone.trim(), password })
      ).unwrap();
      router.replace('/(public)/login');
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not create your account.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create Account"
      subtitle={
        <Subtitle>
          Enter your email and password to create an account.{'\n'}Already have an account?{' '}
          <Link href="/(public)/login" asChild>
            <Text style={styles.inlineLink}>Sign In</Text>
          </Link>
        </Subtitle>
      }
    >
      <AuthField
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Your full name"
        autoComplete="name"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        error={errors.name}
      />
      <AuthField
        ref={emailRef}
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        returnKeyType="next"
        onSubmitEditing={() => phoneRef.current?.focus()}
        error={errors.email}
      />
      <AuthField
        ref={phoneRef}
        label="Phone"
        value={phone}
        onChangeText={setPhone}
        placeholder="Your phone number"
        autoComplete="tel"
        keyboardType="phone-pad"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        error={errors.phone}
      />
      <AuthField
        ref={passwordRef}
        label="Password"
        password
        value={password}
        onChangeText={setPassword}
        placeholder="Create a password"
        autoComplete="new-password"
        returnKeyType="go"
        onSubmitEditing={handleSignup}
        error={errors.password}
      />

      {formError ? <Text style={styles.error}>{formError}</Text> : null}

      <Button
        title="Sign up"
        size="lg"
        onPress={handleSignup}
        loading={submitting}
        disabled={submitting}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  inlineLink: { fontWeight: '700', color: Brand.text },
  error: { color: Brand.error, fontSize: 13, textAlign: 'center' },
});
