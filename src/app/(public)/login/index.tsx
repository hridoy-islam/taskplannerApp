import { Link, Redirect } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AuthField } from '@/components/auth/auth-field';
import { AuthLayout, Subtitle } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Brand } from '@/constants/theme';
import { useAppDispatch, useAppSelector } from '@/hooks/use-redux';
import { isValidEmail } from '@/lib/auth-errors';
import { toast, toastError } from '@/lib/toast';
import { loginUser, resetError } from '@/redux/features/authSlice';

export default function LoginScreen() {
  const dispatch = useAppDispatch();
  const { loading, error, user } = useAppSelector((state) => state.auth);
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
    if (Object.keys(next).length) return;

    dispatch(loginUser({ email: email.trim(), password }))
      .unwrap()
      .then((res: any) => toast.success('Welcome back!', res?.data?.user?.name ? `Signed in as ${res.data.user.name}` : 'Signed in successfully.'))
      .catch((err) => toastError(err, 'Login failed'));
  };

  return (
    <AuthLayout title="Welcome Back" subtitle={<Subtitle>Please enter your details</Subtitle>}>
      <AuthField
        label="Email"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          if (error) dispatch(resetError());
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
            if (error) dispatch(resetError());
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

      {error ? <Text style={styles.error}>{String(error)}</Text> : null}

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
