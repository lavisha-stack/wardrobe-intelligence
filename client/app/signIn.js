import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';

import { supabase } from '../lib/supabase';
import SoftCard from '../components/SoftCard';
import PrimaryButton from '../components/PrimaryButton';
import Colors from '../constants/colors';
import Spacing from '../constants/spacing';
import Typography from '../constants/typography';

export default function SignIn() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert(
        'Missing info',
        'Please enter both email and password.'
      );
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      Alert.alert(
        'Sign in failed',
        error.message
      );
      return;
    }

    router.replace('/(tabs)/home');
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>
        Welcome back
      </Text>

      <SoftCard style={styles.card}>
        <Text style={styles.label}>
          Email
        </Text>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={Colors.textLight}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          editable={!loading}
        />

        <Text
          style={[
            styles.label,
            { marginTop: Spacing.md },
          ]}
        >
          Password
        </Text>

        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Your password"
          placeholderTextColor={Colors.textLight}
          secureTextEntry
          autoCapitalize="none"
          editable={!loading}
        />
      </SoftCard>

      <PrimaryButton
        title={loading ? 'Signing in...' : 'Sign In'}
        onPress={handleSignIn}
        disabled={loading}
      />

      <Text
        style={styles.backText}
        onPress={() => router.replace('/')}
      >
        Don't have an account?{' '}
        <Text style={styles.backLink}>
          Sign Up
        </Text>
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: Colors.background,
    padding: Spacing.lg,
    paddingTop: Spacing.xxl,
  },

  title: {
    ...Typography.heading,
    color: Colors.text,
    marginBottom: Spacing.xl,
    textAlign: 'center',
  },

  card: {
    marginBottom: Spacing.md,
  },

  label: {
    ...Typography.caption,
    color: Colors.textLight,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },

  input: {
    backgroundColor: Colors.background,
    borderRadius: Spacing.radiusMedium,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
  },

  backText: {
    ...Typography.body,
    color: Colors.textLight,
    textAlign: 'center',
    marginTop: Spacing.md,
  },

  backLink: {
    color: Colors.text,
    fontWeight: '600',
  },
});