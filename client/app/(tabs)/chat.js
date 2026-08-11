import { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Constants from "expo-constants";

import { supabase } from "../../lib/supabase";
import Colors from "../../constants/colors";
import Spacing from "../../constants/spacing";
import Typography from "../../constants/typography";

function getBackendUrl() {
  const configured = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost || "";
  const host = hostUri.split(":")[0];
  if (host) return `http://${host}:8000`;

  throw new Error("Could not determine the local backend address. Set EXPO_PUBLIC_BACKEND_URL or restart Expo.");
}

const QUICK_PROMPTS = [
  { id: "today", icon: "✨", text: "Today's outfit" },
  { id: "item", icon: "👗", text: "Style an item" },
  { id: "weather", icon: "☀️", text: "Dress for weather" },
  { id: "college", icon: "🎓", text: "College outfit" },
  { id: "event", icon: "🎉", text: "Event / party" },
  { id: "vibe", icon: "💭", text: "My vibe today" },
];

function classifyPlacement(item) {
  const text = `${item.category || ""} ${item.subcategory || ""}`.toLowerCase();

  if (/dress|jumpsuit|romper|gown|saree|sari/.test(text)) return "full";
  if (/shirt|top|blouse|\btee\b|t-shirt|sweater|jumper|hoodie|jacket|coat|blazer|cardigan|kurta|tunic|camisole|tank/.test(text)) return "top";
  if (/pant|trouser|jean|skirt|short|legging|palazzo|culotte/.test(text)) return "bottom";
  if (/shoe|sneaker|heel|sandal|boot|flat|loafer|footwear/.test(text)) return "shoes";
  if (/belt|scarf|stole|dupatta|sash/.test(text)) return "waist";
  return "side";
}

function groupOutfitItems(items) {
  const groups = { full: null, top: null, bottom: null, shoes: null, waist: null, side: [] };

  items.forEach((item) => {
    const placement = classifyPlacement(item);
    if (placement === "side") {
      groups.side.push(item);
      return;
    }
    if (placement === "waist") {
      if (!groups.waist) groups.waist = item;
      else groups.side.push(item);
      return;
    }
    if (!groups[placement]) groups[placement] = item;
    else groups.side.push(item);
  });

  return groups;
}

function itemImageSource(item) {
  return { uri: item.image_url };
}

function OutfitVisual({ items, expanded = false }) {
  const groups = groupOutfitItems(items);
  const sideItems = groups.side.slice(0, 4);

  return (
    <View style={[styles.stage, expanded ? styles.stageExpanded : styles.stageCompact]}>
      <View style={styles.figureArea}>
        {groups.full && <Image source={itemImageSource(groups.full)} style={styles.fullImage} resizeMode="contain" />}
        {!groups.full && groups.top && <Image source={itemImageSource(groups.top)} style={styles.topImage} resizeMode="contain" />}
        {!groups.full && groups.bottom && <Image source={itemImageSource(groups.bottom)} style={styles.bottomImage} resizeMode="contain" />}
        {groups.shoes && <Image source={itemImageSource(groups.shoes)} style={styles.shoesImage} resizeMode="contain" />}
      </View>

      {groups.waist && (
        <View style={styles.waistAccessory}>
          <Image source={itemImageSource(groups.waist)} style={styles.accessoryImage} resizeMode="contain" />
        </View>
      )}

      {sideItems.map((item, index) => (
        <View key={item.id} style={[styles.accessoryChip, index % 2 === 0 ? styles.accessoryLeft : styles.accessoryRight, index < 2 ? styles.accessoryTop : styles.accessoryBottom]}>
          <Image source={itemImageSource(item)} style={styles.accessoryImage} resizeMode="contain" />
        </View>
      ))}
    </View>
  );
}

export default function ChatScreen() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastMessage, setLastMessage] = useState("");
  const [expandedOutfit, setExpandedOutfit] = useState(null);
  const [savedOutfits, setSavedOutfits] = useState({});
  const popAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!expandedOutfit) return;
    popAnim.setValue(0);
    Animated.spring(popAnim, { toValue: 1, useNativeDriver: true, friction: 7, tension: 60 }).start();
  }, [expandedOutfit]);

  const handlePromptPress = (prompt) => setInput(prompt.text);

  const handleSend = async (overrideMessage) => {
    const message = (overrideMessage ?? input).trim();
    if (!message || loading) return;

    setLastMessage(message);
    if (!overrideMessage) setInput("");

    const userMessage = { id: `user-${Date.now()}`, text: message, type: "user" };
    setMessages((current) => [...current, userMessage]);
    setLoading(true);

    try {
      const { data: { user } = {}, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("You are not signed in.");

      const userId = user.id;
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (typeof userId !== "string" || !uuidPattern.test(userId)) {
        throw new Error("Your Supabase session returned an invalid user ID. Please sign out and sign in again.");
      }

      const conversationHistory = messages.map((item) => ({
        role: item.type === "user" ? "user" : "assistant",
        content: item.text || "",
      }));

      const backendUrl = getBackendUrl();
      console.log("AI ASSIST BACKEND:", `${backendUrl}/ai-assist`);
      console.log("AI ASSIST USER ID TYPE:", typeof userId);

      const response = await fetch(`${backendUrl}/ai-assist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, message, conversation_history: conversationHistory }),
      });

      const rawResponse = await response.text();
      let result;
      try {
        result = JSON.parse(rawResponse);
      } catch {
        throw new Error(`AI Assist returned invalid JSON (${response.status}): ${rawResponse.slice(0, 200)}`);
      }

      if (!response.ok) {
        throw new Error(result.detail || result.message || `AI Assist failed (${response.status})`);
      }

      if (result.type === "question") {
        setMessages((current) => [...current, { id: `ai-${Date.now()}`, text: result.message, type: "assistant" }]);
        return;
      }

      if (result.type === "outfits" && Array.isArray(result.outfits)) {
        const uniqueItemIds = [...new Set(result.outfits.flatMap((outfit) => outfit.items || []))];
        let wardrobeItems = [];

        if (uniqueItemIds.length > 0) {
          const { data, error: wardrobeError } = await supabase
            .from("clothing_items")
            .select("id, image_url, normalized_image_url, category, subcategory, description")
            .in("id", uniqueItemIds);
          if (wardrobeError) throw wardrobeError;
          wardrobeItems = data || [];
        }

        const outfitResults = result.outfits.slice(0, 2).map((outfit) => ({
          items: (outfit.items || []).map((itemId) => wardrobeItems.find((item) => item.id === itemId)).filter(Boolean),
        }));

        setMessages((current) => [...current, { id: `ai-${Date.now()}`, type: "outfits", outfits: outfitResults }]);
        return;
      }

      throw new Error("The AI returned an unexpected response.");
    } catch (error) {
      console.error("AI ASSIST ERROR:", error);
      setMessages((current) => [...current, {
        id: `error-${Date.now()}`,
        type: "assistant",
        text: error.message || "Sorry, I couldn't create your outfit right now. Please try again.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenOutfit = (outfitNumber, items) => {
    setExpandedOutfit({ key: `${outfitNumber}-${Date.now()}`, outfitNumber, items });
  };

  const handleSaveExpandedOutfit = () => {
    if (!expandedOutfit) return;
    setSavedOutfits((current) => ({ ...current, [expandedOutfit.key]: true }));
  };

  const handleRetry = () => {
    setExpandedOutfit(null);
    if (lastMessage) handleSend(lastMessage);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Assist ✨</Text>
        <Text style={styles.subtitle}>Tell me what you're dressing for.</Text>
      </View>

      <ScrollView style={styles.conversation} contentContainerStyle={styles.conversationContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {messages.length === 0 ? (
          <View style={styles.emptyConversation}>
            <Text style={styles.emptyEmoji}>🧥</Text>
            <Text style={styles.emptyTitle}>Let's find you something to wear.</Text>
            <Text style={styles.emptyText}>Tell me about your day, your plans, the weather, or even just your vibe.</Text>
          </View>
        ) : (
          <>
            {messages.map((message) => (
              <View key={message.id} style={styles.messageBlock}>
                {message.type === "user" && <View style={styles.userMessage}><Text style={styles.userMessageText}>{message.text}</Text></View>}
                {message.type === "assistant" && <View style={styles.aiMessage}><Text style={styles.aiLabel}>AI Assist ✨</Text><Text style={styles.aiMessageText}>{message.text}</Text></View>}
                {message.type === "outfits" && <OutfitResults outfits={message.outfits} onOpenOutfit={handleOpenOutfit} />}
              </View>
            ))}
            {loading && <View style={styles.loadingMessage}><Text style={styles.loadingEmoji}>✨</Text><Text style={styles.loadingText}>Styling your wardrobe...</Text></View>}
          </>
        )}
      </ScrollView>

      <View style={styles.promptSection}>
        <Text style={styles.promptHeading}>Try asking</Text>
        <FlatList
          data={QUICK_PROMPTS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.promptList}
          renderItem={({ item }) => (
            <Pressable style={styles.promptPill} onPress={() => handlePromptPress(item)}>
              <Text style={styles.promptIcon}>{item.icon}</Text>
              <Text style={styles.promptText}>{item.text}</Text>
            </Pressable>
          )}
        />
      </View>

      <View style={styles.inputContainer}>
        <TextInput style={styles.input} value={input} onChangeText={setInput} placeholder="Tell me what your day looks like..." placeholderTextColor={Colors.textLight} multiline textAlignVertical="top" autoCapitalize="sentences" returnKeyType="default" />
        <Pressable style={[styles.sendButton, (!input.trim() || loading) && styles.sendButtonDisabled]} disabled={!input.trim() || loading} onPress={() => handleSend()}>
          <Text style={styles.sendText}>↑</Text>
        </Pressable>
      </View>

      <Modal visible={!!expandedOutfit} transparent animationType="fade" onRequestClose={() => setExpandedOutfit(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setExpandedOutfit(null)}>
          {expandedOutfit && (
            <Animated.View style={[styles.modalCard, { opacity: popAnim, transform: [{ scale: popAnim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }] }]}>
              <Pressable onPress={() => {}}>
                <View style={styles.modalHeader}>
                  <View><Text style={styles.modalEyebrow}>YOUR LOOK</Text><Text style={styles.modalTitle}>Outfit {expandedOutfit.outfitNumber}</Text></View>
                  <Pressable style={styles.closeButton} onPress={() => setExpandedOutfit(null)}><Text style={styles.closeButtonText}>×</Text></Pressable>
                </View>
                <OutfitVisual items={expandedOutfit.items} expanded />
                <View style={styles.itemLabels}>
                  <Text style={styles.itemLabel}>Top</Text><Text style={styles.itemLabel}>Bottom</Text><Text style={styles.itemLabel}>Shoes</Text><Text style={styles.itemLabel}>Accessories</Text>
                </View>
                <View style={styles.outfitActions}>
                  <Pressable style={[styles.saveButton, savedOutfits[expandedOutfit.key] && styles.savedButton]} onPress={handleSaveExpandedOutfit}><Text style={[styles.saveButtonText, savedOutfits[expandedOutfit.key] && styles.savedButtonTextSaved]}>{savedOutfits[expandedOutfit.key] ? "✓ Saved" : "♡ Save"}</Text></Pressable>
                  <Pressable style={styles.retryButton} onPress={handleRetry}><Text style={styles.retryButtonText}>↻ Retry</Text></Pressable>
                </View>
              </Pressable>
            </Animated.View>
          )}
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function OutfitResults({ outfits, onOpenOutfit }) {
  const visibleOutfits = outfits.slice(0, 2);
  return (
    <View style={styles.outfitResults}>
      <Text style={styles.outfitResultsTitle}>Here's what I'd wear ✨</Text>
      <View style={styles.outfitRow}>
        {visibleOutfits.map((outfit, index) => (
          <Pressable key={`outfit-${index}`} style={styles.outfitCard} onPress={() => onOpenOutfit(index + 1, outfit.items)}>
            <Text style={styles.outfitCardTitle}>Outfit {index + 1}</Text>
            <OutfitVisual items={outfit.items} expanded={false} />
            <View style={styles.cardFooter}><Text style={styles.tapHint}>Tap to view</Text><Text style={styles.cardArrow}>↗</Text></View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: Spacing.lg, paddingTop: Spacing.xxl },
  header: { marginBottom: Spacing.md },
  title: { ...Typography.heading, color: Colors.text, marginBottom: Spacing.xs },
  subtitle: { ...Typography.body, color: Colors.textLight },
  conversation: { flex: 1 },
  conversationContent: { paddingBottom: Spacing.md },
  emptyConversation: { alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.lg, paddingTop: 55 },
  emptyEmoji: { fontSize: 42, marginBottom: Spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: Colors.text, textAlign: "center", marginBottom: Spacing.sm },
  emptyText: { fontSize: 13, lineHeight: 19, color: Colors.textLight, textAlign: "center", maxWidth: 300 },
  messageBlock: { marginBottom: Spacing.lg },
  userMessage: { alignSelf: "flex-end", maxWidth: "85%", backgroundColor: Colors.text, borderRadius: 18, borderBottomRightRadius: 5, paddingHorizontal: 14, paddingVertical: 10, marginBottom: Spacing.md },
  userMessageText: { color: "#FFFFFF", fontSize: 14, lineHeight: 19 },
  aiMessage: { alignSelf: "flex-start", maxWidth: "88%", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: Colors.border, borderRadius: 18, borderBottomLeftRadius: 5, paddingHorizontal: 14, paddingVertical: 11 },
  aiLabel: { fontSize: 11, fontWeight: "600", color: Colors.textLight, marginBottom: 4 },
  aiMessageText: { fontSize: 14, lineHeight: 20, color: Colors.text },
  loadingMessage: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingVertical: Spacing.sm },
  loadingEmoji: { fontSize: 14, marginRight: 6 },
  loadingText: { fontSize: 12, color: Colors.textLight },
  promptSection: { marginBottom: Spacing.sm },
  promptHeading: { fontSize: 13, fontWeight: "600", color: Colors.text, marginBottom: 7 },
  promptList: { gap: 7, paddingRight: 10 },
  promptPill: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: Colors.border, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 7 },
  promptIcon: { fontSize: 13, marginRight: 5 },
  promptText: { fontSize: 11.5, color: Colors.text },
  inputContainer: { minHeight: 165, maxHeight: 210, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: Colors.border, borderRadius: 22, padding: 15, marginBottom: Spacing.sm, position: "relative" },
  input: { flex: 1, fontSize: 15, lineHeight: 22, color: Colors.text, paddingRight: 45, paddingTop: 2, paddingBottom: 40 },
  sendButton: { position: "absolute", right: 12, bottom: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.text, alignItems: "center", justifyContent: "center" },
  sendButtonDisabled: { opacity: 0.3 },
  sendText: { color: "#FFFFFF", fontSize: 21, lineHeight: 23, fontWeight: "500" },
  outfitResults: { marginTop: Spacing.md },
  outfitResultsTitle: { fontSize: 16, fontWeight: "600", color: Colors.text, marginBottom: Spacing.sm },
  outfitRow: { flexDirection: "row", gap: 10 },
  outfitCard: { flex: 1, minWidth: 0, backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: Colors.border, overflow: "hidden", padding: 10 },
  outfitCardTitle: { fontSize: 13, fontWeight: "600", color: Colors.text, marginBottom: 7 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 6, minHeight: 18 },
  tapHint: { fontSize: 10.5, color: Colors.textLight },
  cardArrow: { fontSize: 13, color: Colors.textLight, marginLeft: 5 },
  stage: { position: "relative", width: "100%", backgroundColor: Colors.background, borderRadius: 14, overflow: "hidden" },
  stageCompact: { height: 190 },
  stageExpanded: { height: 390 },
  figureArea: { position: "absolute", left: "18%", right: "18%", top: "2%", bottom: "2%" },
  fullImage: { position: "absolute", left: "4%", top: "0%", width: "92%", height: "100%" },
  topImage: { position: "absolute", left: "2%", top: "0%", width: "96%", height: "47%" },
  bottomImage: { position: "absolute", left: "6%", top: "43%", width: "88%", height: "43%" },
  shoesImage: { position: "absolute", left: "8%", top: "81%", width: "84%", height: "18%" },
  waistAccessory: { position: "absolute", left: "58%", top: "39%", width: "24%", height: "15%", zIndex: 4 },
  accessoryChip: { position: "absolute", width: "20%", height: "20%", borderRadius: 10, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center", zIndex: 5, padding: 4 },
  accessoryLeft: { left: "2%" },
  accessoryRight: { right: "2%" },
  accessoryTop: { top: "6%" },
  accessoryBottom: { top: "70%" },
  accessoryImage: { width: "100%", height: "100%" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", paddingHorizontal: 18, paddingVertical: 28 },
  modalCard: { width: "100%", maxWidth: 360, backgroundColor: "#FFFFFF", borderRadius: 24, padding: 15, shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  modalEyebrow: { fontSize: 9, letterSpacing: 1.2, fontWeight: "700", color: Colors.textLight, marginBottom: 2 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: Colors.text },
  closeButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.background, alignItems: "center", justifyContent: "center" },
  closeButtonText: { fontSize: 21, lineHeight: 22, color: Colors.textLight, fontWeight: "400" },
  itemLabels: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 6, marginTop: 8 },
  itemLabel: { fontSize: 9.5, color: Colors.textLight, textTransform: "uppercase", letterSpacing: 0.5 },
  outfitActions: { flexDirection: "row", gap: 8, paddingTop: 12 },
  saveButton: { flex: 1, height: 38, borderRadius: 19, backgroundColor: Colors.text, alignItems: "center", justifyContent: "center" },
  savedButton: { backgroundColor: "#E8E8E8" },
  saveButtonText: { color: "#FFFFFF", fontSize: 11.5, fontWeight: "600" },
  savedButtonTextSaved: { color: Colors.text },
  retryButton: { flex: 1, height: 38, borderRadius: 19, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  retryButtonText: { color: Colors.text, fontSize: 11.5, fontWeight: "600" },
  modalCard: { width: "100%", maxWidth: 360, backgroundColor: "#FFFFFF", borderRadius: 24, padding: 15, shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
});
