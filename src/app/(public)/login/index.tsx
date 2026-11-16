import { Link, Redirect } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AuthField } from '@/components/auth/auth-field';
import { AuthLayout, Subtitle } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Brand } from '@/constants/theme';
import { useAppDispatch, useAppSelector } from '@/hooks/use-redux';
import { authErrorField, getErrorMessage, isValidEmail } from '@/lib/auth-errors';
import { loginUser, resetError } from '@/redux/features/authSlice';

export default function LoginScreen() {
  const dispatch = useAppDispatch();
  const { loading, error, user } = useAppSelector((state) => state.auth);
  const [formError, setFormError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const passwordRef = useRef<TextInput>(null);

  if (user) {
    return <Redirect href="/" />;
  }

  const handleLogin = () => {
    const next: typeof fieldErrors = {};
    if (!isValidEmail(email)) next.email = 'Enter a valid email address';
    if (!password) next.password = 'Enter your password';
    setFieldErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;

    // No toasts on the auth screens: errors show under the field they're about, otherwise below the form.
    // Success needs no message — the app opens.
    dispatch(loginUser({ email: email.trim(), password }))
      .unwrap()
      .catch((err) => {
        const message = getErrorMessage(err, 'Login failed. Please try again.');
        const field = authErrorField(message);
        if (field) setFieldErrors({ [field]: message });
        else setFormError(message);
      });
  };

  const clearErrors = () => {
    if (error) dispatch(resetError());
    if (formError) setFormError(null);
  };

  return (
    <AuthLayout title="Welcome Back" subtitle={<Subtitle>Please enter your details</Subtitle>}>
      <AuthField
        label="Email"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          clearErrors();
          if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }));
        }}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        error={fieldErrors.email}
      />

      <View>
        <AuthField
          ref={passwordRef}
          label="Password"
          password
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            clearErrors();
            if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined }));
          }}
          placeholder="Enter your password"
          autoComplete="password"
          returnKeyType="go"
          onSubmitEditing={handleLogin}
          error={fieldErrors.password}
        />
        <Link href="/(public)/forgot-password" asChild>
          <Pressable hitSlop={8} style={styles.forgot}>
            <Text style={styles.forgotText}>Forget Password</Text>
          </Pressable>
        </Link>
      </View>

      {formError ? <Text style={styles.error}>{formError}</Text> : null}

      <Button title="Log in" size="lg" onPress={handleLogin} loading={loading} disabled={loading} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Don&apos;t have an account? </Text>
        <Link href="/(public)/signup" asChild>
          <Pressable hitSlop={8}>
            <Text style={styles.link}>Sign Up</Text>
          </Pressable>
        </Link>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  forgot: { alignSelf: 'flex-end', marginTop: 10 },
  forgotText: { fontSize: 12, fontWeight: '600', color: Brand.text },
  error: { color: Brand.error, fontSize: 13, textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  footerText: { fontSize: 13, color: Brand.text },
  link: { fontSize: 13, fontWeight: '600', color: Brand.link },
});
