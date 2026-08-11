import { useRouter } from "expo-router";
import { View, Text, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator } from "react-native";
import { useState, useEffect } from "react";
import Colors from "../../constants/colors";
import Typography from "../../constants/typography";
import { supabase } from "../../lib/supabase";
import SoftCard from "../../components/SoftCard";
import PrimaryButton from "../../components/PrimaryButton";
import ActionTile from "../../components/ActionTile";
import SectionTitle from "../../components/SectionTitle";

function getWardrobeCategory(item) {
  const text = [item.category, item.subcategory].filter(Boolean).join(" ").toLowerCase();
  if (["dress", "gown", "jumpsuit", "romper"].some((v) => text.includes(v))) return "Dresses";
  if (["shoe", "sneaker", "sandal", "boot", "heel", "loafer", "flat", "slipper", "crocs"].some((v) => text.includes(v))) return "Shoes";
  if (["jacket", "coat", "blazer", "cardigan", "hoodie", "sweater", "sweatshirt", "outerwear", "shrug"].some((v) => text.includes(v))) return "Outerwear";
  if (["bag", "belt", "scarf", "hat", "cap", "jewelry", "jewellery", "necklace", "bracelet", "earring", "watch", "accessory", "accessories"].some((v) => text.includes(v))) return "Accessories";
  if (["jean", "pant", "trouser", "short", "skirt", "legging", "bottom"].some((v) => text.includes(v))) return "Bottoms";
  if (["shirt", "t-shirt", "tee", "top", "blouse", "tank", "camisole", "polo", "crop top", "kurti", "kurta"].some((v) => text.includes(v))) return "Tops";
  return "Tops";
}

export default function HomeScreen() {
  const [name, setName] = useState("");
  const [wardrobeStats, setWardrobeStats] = useState({ total: 0, tops: 0, bottoms: 0, shoes: 0 });
  const [loadingWardrobe, setLoadingWardrobe] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadHome = async () => {
      setLoadingWardrobe(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const [{ data: profile }, { data: items, error: wardrobeError }] = await Promise.all([
          supabase.from("profiles").select("name").eq("id", user.id).single(),
          supabase.from("clothing_items").select("category, subcategory").eq("user_id", user.id),
        ]);
        if (profile?.name) setName(profile.name);
        if (wardrobeError) throw wardrobeError;
        const wardrobe = items || [];
        setWardrobeStats({
          total: wardrobe.length,
          tops: wardrobe.filter((item) => getWardrobeCategory(item) === "Tops").length,
          bottoms: wardrobe.filter((item) => getWardrobeCategory(item) === "Bottoms").length,
          shoes: wardrobe.filter((item) => getWardrobeCategory(item) === "Shoes").length,
        });
      } catch (error) {
        console.error("HOME WARDROBE LOAD ERROR:", error);
      } finally {
        setLoadingWardrobe(false);
      }
    };
    loadHome();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.smallText}>Good Evening ✨</Text>
          <Text style={styles.name}>Hi {name || "there"}</Text>
        </View>
        <SectionTitle>Today's Outfit</SectionTitle>
        <SoftCard style={styles.outfitCard}>
          <Text style={styles.outfitEmoji}>👗</Text>
          <Text style={styles.outfitTitle}>No outfit generated yet</Text>
          <Text style={styles.outfitSubtitle}>Tap below and let AI create something from your wardrobe.</Text>
          <View style={{ marginTop: 22, width: "100%" }}><PrimaryButton title="Generate Outfit ✨" onPress={() => {}} /></View>
        </SoftCard>
        <SectionTitle>Quick Actions</SectionTitle>
        <View style={styles.row}>
          <ActionTile emoji="👕" title="Add Clothing" onPress={() => router.push("/upload")} />
          <View style={{ width: 14 }} />
          <ActionTile emoji="🔍" title="Analyze Item" onPress={() => {}} />
        </View>
        <SectionTitle>Your Wardrobe</SectionTitle>
        <SoftCard>
          {loadingWardrobe ? <ActivityIndicator size="small" color={Colors.text} /> : <>
            <Text style={styles.total}>{wardrobeStats.total}</Text>
            <Text style={styles.totalLabel}>{wardrobeStats.total === 1 ? "piece" : "pieces"} waiting to be loved ✨</Text>
            <View style={styles.stats}>
              <View style={styles.stat}><Text style={styles.number}>{wardrobeStats.tops}</Text><Text style={styles.label}>Tops</Text></View>
              <View style={styles.stat}><Text style={styles.number}>{wardrobeStats.bottoms}</Text><Text style={styles.label}>Bottoms</Text></View>
              <View style={styles.stat}><Text style={styles.number}>{wardrobeStats.shoes}</Text><Text style={styles.label}>Shoes</Text></View>
            </View>
          </>}
        </SoftCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: 22 },
  scrollContent: { paddingTop: 20, paddingBottom: 40 },
  header: { marginBottom: 30 },
  smallText: { ...Typography.body, color: Colors.textLight },
  name: { ...Typography.heading, color: Colors.text, marginTop: 6 },
  outfitCard: { alignItems: "center", marginBottom: 28 },
  outfitEmoji: { fontSize: 60, marginBottom: 18 },
  outfitTitle: { ...Typography.subHeading, color: Colors.text, textAlign: "center" },
  outfitSubtitle: { ...Typography.body, color: Colors.textLight, textAlign: "center", marginTop: 10, lineHeight: 24 },
  row: { flexDirection: "row", marginBottom: 30 },
  total: { fontSize: 52, fontWeight: "700", color: Colors.primary, textAlign: "center" },
  totalLabel: { ...Typography.body, textAlign: "center", color: Colors.textLight, marginTop: 6, marginBottom: 24 },
  stats: { flexDirection: "row", justifyContent: "space-around" },
  stat: { alignItems: "center" },
  number: { fontSize: 22, fontWeight: "700", color: Colors.text },
  label: { ...Typography.caption, color: Colors.textLight, marginTop: 4 },
});
