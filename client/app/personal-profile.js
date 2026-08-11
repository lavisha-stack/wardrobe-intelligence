import { useState } from 'react';
import { StyleSheet, Text, TextInput, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import TagSelector from '../components/TagSelector';
import SoftCard from '../components/SoftCard';
import PrimaryButton from '../components/PrimaryButton';
import Colors from '../constants/colors';
import Spacing from '../constants/spacing';
import Typography from '../constants/typography';

const PREFER_NOT_TO_SAY = 'Prefer not to say';

const STYLE_TAGS = [
  PREFER_NOT_TO_SAY, 'Casual', 'Minimal', 'Streetwear', 'Classic', 'Boho',
  'Preppy', 'Formal', 'Athleisure', 'Vintage', 'Grunge', 'Y2K', 'Old Money', 'Cottagecore',
];

export default function PersonalProfile() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [selectedStyles, setSelectedStyles] = useState([]);
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      Alert.alert('Not signed in', 'Please sign up again.');
      router.push('/signup');
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        name: name.trim(),
        style_tags: selectedStyles,
      });

    setSaving(false);

    if (error) {
      Alert.alert('Could not save profile', error.message);
      return;
    }

    router.replace('/(tabs)/home');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Tell us a little about you</Text>

      <SoftCard style={styles.card}>
        <Text style={styles.label}>Your name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Lavisha"
          placeholderTextColor={Colors.textLight}
        />
      </SoftCard>

      <SoftCard style={styles.card}>
        <Text style={styles.label}>Your style</Text>
        <TagSelector
          options={STYLE_TAGS}
          selected={selectedStyles}
          onChange={setSelectedStyles}
          exclusiveOption={PREFER_NOT_TO_SAY}
          allowCustom
        />
      </SoftCard>

      <PrimaryButton
        title={saving ? 'Saving...' : 'Continue'}
        onPress={handleContinue}
        disabled={saving}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: Colors.background, padding: Spacing.lg, paddingTop: Spacing.xxl },
  title: { ...Typography.heading, color: Colors.text, marginBottom: Spacing.xl, textAlign: 'center' },
  card: { marginBottom: Spacing.md },
  label: { ...Typography.caption, color: Colors.textLight, marginBottom: Spacing.sm, textTransform: 'uppercase' },
  input: {
    backgroundColor: Colors.background,
    borderRadius: Spacing.radiusMedium,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
  },
});