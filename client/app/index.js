import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import Colors from '../constants/colors';
import Spacing from '../constants/spacing';
import Typography from '../constants/typography';
import PrimaryButton from '../components/PrimaryButton';

export default function Welcome() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.title}>
          Wardrobe{'\n'}Intelligence
        </Text>

        <Text style={styles.subtitle}>
          Your AI-powered closet companion
        </Text>
      </View>

      <View>
        <PrimaryButton
          title="Get Started"
          onPress={() => router.push('/signup')}
        />

        <Text
          style={styles.signInText}
          onPress={() => router.push('/signIn')}
        >
          Already have an account?{' '}
          <Text style={styles.signInLink}>
            Sign In
          </Text>
        </Text>
      </View>

      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl * 2,
    paddingBottom: Spacing.xxl,
  },

  title: {
    ...Typography.heading,
    fontSize: 36,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },

  subtitle: {
    ...Typography.body,
    color: Colors.textLight,
  },

  signInText: {
    ...Typography.body,
    color: Colors.textLight,
    textAlign: 'center',
    marginTop: Spacing.md,
  },

  signInLink: {
    color: Colors.text,
    fontWeight: '600',
  },
});