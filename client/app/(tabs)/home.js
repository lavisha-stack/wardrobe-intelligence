import { useRouter } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from "react-native";

import Colors from "../../constants/colors";
import Typography from "../../constants/typography";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import SoftCard from "../../components/SoftCard";
import PrimaryButton from "../../components/PrimaryButton";
import ActionTile from "../../components/ActionTile";
import SectionTitle from "../../components/SectionTitle";

export default function HomeScreen() {
  const [name, setName] = useState('');
  const router = useRouter();

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single();
      if (data?.name) setName(data.name);
    };
    fetchProfile();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View style={styles.header}>
          <Text style={styles.smallText}>Good Evening ✨</Text>
         <Text style={styles.name}>Hi {name || 'there'}</Text>
        </View>

        {/* Today's Outfit */}
        <SectionTitle>Today's Outfit</SectionTitle>

        <SoftCard style={styles.outfitCard}>
          <Text style={styles.outfitEmoji}>👗</Text>

          <Text style={styles.outfitTitle}>
            No outfit generated yet
          </Text>

          <Text style={styles.outfitSubtitle}>
            Tap below and let AI create something from your wardrobe.
          </Text>

          <View style={{ marginTop: 22, width: "100%" }}>
            <PrimaryButton
              title="Generate Outfit ✨"
              onPress={() => {}}
            />
          </View>
        </SoftCard>

        {/* Quick Actions */}
        <SectionTitle>Quick Actions</SectionTitle>

        <View style={styles.row}>
          <ActionTile
            emoji="👕"
            title="Add Clothing"
            onPress={() => router.push('/upload')}
          />

          <View style={{ width: 14 }} />

          <ActionTile
            emoji="🔍"
            title="Analyze Item"
            onPress={() => {}}
          />
        </View>

        {/* Wardrobe */}
        <SectionTitle>Your Wardrobe</SectionTitle>

        <SoftCard>
          <Text style={styles.total}>0</Text>

          <Text style={styles.totalLabel}>
            pieces waiting to be loved ✨
          </Text>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.number}>0</Text>
              <Text style={styles.label}>Tops</Text>
            </View>

            <View style={styles.stat}>
              <Text style={styles.number}>0</Text>
              <Text style={styles.label}>Bottoms</Text>
            </View>

            <View style={styles.stat}>
              <Text style={styles.number}>0</Text>
              <Text style={styles.label}>Shoes</Text>
            </View>
          </View>
        </SoftCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 22,
  },

  scrollContent: {
    paddingTop: 20,
    paddingBottom: 40,
  },

  header: {
    marginBottom: 30,
  },

  smallText: {
    ...Typography.body,
    color: Colors.textLight,
  },

  name: {
    ...Typography.heading,
    color: Colors.text,
    marginTop: 6,
  },

  outfitCard: {
    alignItems: "center",
    marginBottom: 28,
  },

  outfitEmoji: {
    fontSize: 60,
    marginBottom: 18,
  },

  outfitTitle: {
    ...Typography.subHeading,
    color: Colors.text,
    textAlign: "center",
  },

  outfitSubtitle: {
    ...Typography.body,
    color: Colors.textLight,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 24,
  },

  row: {
    flexDirection: "row",
    marginBottom: 30,
  },

  total: {
    fontSize: 52,
    fontWeight: "700",
    color: Colors.primary,
    textAlign: "center",
  },

  totalLabel: {
    ...Typography.body,
    textAlign: "center",
    color: Colors.textLight,
    marginTop: 6,
    marginBottom: 24,
  },

  stats: {
    flexDirection: "row",
    justifyContent: "space-around",
  },

  stat: {
    alignItems: "center",
  },

  number: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.text,
  },

  label: {
    ...Typography.caption,
    color: Colors.textLight,
    marginTop: 4,
  },
});