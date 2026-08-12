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
  const text = `${item.category || ""} ${item.subcategory || ""} ${item.description || ""}`.toLowerCase();

  if (/dress|jumpsuit|romper|gown|saree|sari/.test(text)) return "full";
  if (/shirt|top|blouse|\btee\b|t-shirt|sweater|jumper|hoodie|jacket|coat|blazer|cardigan|kurta|kurti|tunic|camisole|tank/.test(text)) return "top";
  if (/pant|trouser|jean|skirt|short|legging|palazzo|culotte|bottom/.test(text)) return "bottom";
  if (/shoe|sneaker|heel|sandal|boot|flat|loafer|footwear/.test(text)) return "shoes";
  if (/belt|scarf|stole|dupatta|sash|bag|handbag|purse|necklace|earring|bracelet|watch/.test(text)) return "accessory";
  return "side";
}

function groupOutfitItems(items) {
  const groups = { full: null, top: null, bottom: null, shoes: null, accessories: [], side: [] };

  items.forEach((item) => {
    const placement = classifyPlacement(item);
    if (placement === "full") {
      if (!groups.full) groups.full = item;
      else groups.side.push(item);
      return;
    }
    if (placement === "accessory") {
      groups.accessories.push(item);
      return;
    }
    if (!groups[placement]) groups[placement] = item;
    else groups.side.push(item);
  });

  return groups;
}

function getItemImageUri(item) {
  const normalized = item?.normalized_image_url?.trim();
  const original = item?.image_url?.trim();
  if (!normalized && !original) return null;

  // Prefer the processed transparent cutout. The query parameter also prevents
  // React Native's image cache from reusing an older response for this item.
  if (normalized) {
    return `${normalized}${normalized.includes("?") ? "&" : "?"}aiassist=${encodeURIComponent(item.id || Date.now())}`;
  }
  return original;
}

function ClothingImage({ item, style, contain = true }) {
  const [source, setSource] = useState(getItemImageUri(item));
  const normalized = item?.normalized_image_url?.trim();

  useEffect(() => {
    setSource(getItemImageUri(item));
  }, [item?.id, item?.normalized_image_url, item?.image_url]);

  if (!source) return null;

  return (
    <Image
      source={{ uri: source }}
      style={style}
      resizeMode={contain ? "contain" : "cover"}
      onError={() => {
        // Only fall back to the original if the normalized image itself cannot
        // be loaded. We never intentionally display the original when a valid
        // normalized URL is available.
        if (normalized && item?.image_url && source !== item.image_url) {
          setSource(item.image_url);
        }
      }}
    />
  );
}

function Piece({ item, kind, expanded }) {
  if (!item) return null;

  return (
    <View style={[styles.piece, expanded ? styles.pieceExpanded : styles.pieceCompact]}>
      <ClothingImage
        item={item}
        style={kind === "shoes" ? styles.shoesImage : kind === "full" ? styles.fullImage : styles.clothingImage}
      />
    </View>
  );
}

function OutfitVisual({ items, expanded = false }) {
  const groups = groupOutfitItems(items);
  const extras = [...groups.accessories, ...groups.side].slice(0, 4);

  return (
    <View style={[styles.stage, expanded ? styles.stageExpanded : styles.stageCompact]}>
      {groups.full ? (
        <View style={styles.fullPieceArea}>
          <Piece item={groups.full} kind="full" expanded={expanded} />
        </View>
      ) : (
        <View style={styles.mainPieces}>
          <Piece item={groups.top} kind="top" expanded={expanded} />
          <Piece item={groups.bottom} kind="bottom" expanded={expanded} />
          <Piece item={groups.shoes} kind="shoes" expanded={expanded} />
        </View>
      )}

      {extras.length > 0 && (
        <View style={styles.accessoryRow}>
          {extras.map((item) => (
            <View key={item.id} style={styles.accessoryBox}>
              <ClothingImage item={item} style={styles.accessoryImage} />
            </View>
          ))}
        </View>
      )}
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
    Animated.spring(popAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 7,
      tension: 60,
    }).start();
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
        body: JSON.stringify({
          user_id: userId,
          message,
          conversation_history: conversationHistory,
        }),
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
        setMessages((current) => [
          ...current,
          { id: `ai-${Date.now()}`, text: result.message, type: "assistant" },
        ]);
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

        console.log(
          "AI ASSIST IMAGE SOURCES:",
          wardrobeItems.map((item) => ({ id: item.id, normalized: item.normalized_image_url, original: item.image_url }))
        );

        const outfitResults = result.outfits.slice(0, 2).map((outfit) => ({
          title: outfit.title || "Your look",
          items: (outfit.items || [])
            .map((itemId) => wardrobeItems.find((item) => item.id === itemId))
            .filter(Boolean),
        }));

        setMessages((current) => [
          ...current,
          { id: `ai-${Date.now()}`, type: "outfits", outfits: outfitResults },
        ]);
        return;
      }

      throw new Error("The AI returned an unexpected response.");
    } catch (error) {
      console.error("AI ASSIST ERROR:", error);
      setMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          type: "assistant",
          text: error.message || "Sorry, I couldn't create your outfit right now. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenOutfit = (outfitNumber, outfit) => {
    setExpandedOutfit({
      key: `${outfitNumber}-${Date.now()}`,
      outfitNumber,
      title: outfit.title,
      items: outfit.items,
    });
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
                {message.type === "user" && (
                  <View style={styles.userMessage}>
                    <Text style={styles.userMessageText}>{message.text}</Text>
                  </View>
                )}
                {message.type === "assistant" && (
                  <View style={styles.aiMessage}>
                    <Text style={styles.aiLabel}>AI Assist ✨</Text>
                    <Text style={styles.aiMessageText}>{message.text}</Text>
                  </View>
                )}
                {message.type === "outfits" && <OutfitResults outfits={message.outfits} onOpenOutfit={handleOpenOutfit} />}
              </View>
            ))}
            {loading && (
              <View style={styles.loadingMessage}>
                <Text style={styles.loadingEmoji}>✨</Text>
                <Text style={styles.loadingText}>Styling your wardrobe...</Text>
              </View>
            )}
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
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Tell me what your day looks like..."
          placeholderTextColor={Colors.textLight}
          multiline
          textAlignVertical="top"
          autoCapitalize="sentences"
          returnKeyType="default"
        />
        <Pressable style={[styles.sendButton, (!input.trim() || loading) && styles.sendButtonDisabled]} disabled={!input.trim() || loading} onPress={() => handleSend()}>
          <Text style={styles.sendText}>↑</Text>
        </Pressable>
      </View>

      <Modal visible={!!expandedOutfit} transparent animationType="fade" onRequestClose={() => setExpandedOutfit(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setExpandedOutfit(null)}>
          {expandedOutfit && (
            <Animated.View
              style={[
                styles.modalCard,
                {
                  opacity: popAnim,
                  transform: [{ scale: popAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
                },
              ]}
            >
              <Pressable onPress={() => {}}>
                <View style={styles.modalHeader}>
                  <View style={styles.modalTitleBlock}>
                    <Text style={styles.modalEyebrow}>YOUR LOOK</Text>
                    <Text style={styles.modalTitle}>Outfit {expandedOutfit.outfitNumber}</Text>
                    {!!expandedOutfit.title && <Text style={styles.modalSubtitle}>{expandedOutfit.title}</Text>}
                  </View>
                  <Pressable style={styles.closeButton} onPress={() => setExpandedOutfit(null)}>
                    <Text style={styles.closeButtonText}>×</Text>
                  </Pressable>
                </View>

                <OutfitVisual items={expandedOutfit.items} expanded />

                <View style={styles.itemLabels}>
                  <Text style={styles.itemLabel}>Top</Text>
                  <Text style={styles.itemLabel}>Bottom</Text>
                  <Text style={styles.itemLabel}>Shoes</Text>
                  <Text style={styles.itemLabel}>Accessories</Text>
                </View>

                <View style={styles.outfitActions}>
                  <Pressable style={[styles.saveButton, savedOutfits[expandedOutfit.key] && styles.savedButton]} onPress={handleSaveExpandedOutfit}>
                    <Text style={[styles.saveButtonText, savedOutfits[expandedOutfit.key] && styles.savedButtonTextSaved]}>
                      {savedOutfits[expandedOutfit.key] ? "✓ Saved" : "♡ Save"}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.retryButton} onPress={handleRetry}>
                    <Text style={styles.retryButtonText}>↻ Retry</Text>
                  </Pressable>
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
          <Pressable key={`outfit-${index}`} style={styles.outfitCard} onPress={() => onOpenOutfit(index + 1, outfit)}>
            <Text style={styles.outfitCardTitle}>Outfit {index + 1}</Text>
            {!!outfit.title && <Text style={styles.outfitCardSubtitle}>{outfit.title}</Text>}
            <OutfitVisual items={outfit.items} />
            <View style={styles.cardFooter}>
              <Text style={styles.tapHint}>Tap to view</Text>
              <Text style={styles.cardArrow}>↗</Text>
            </View>
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
  outfitCardTitle: { fontSize: 13, fontWeight: "600", color: Colors.text },
  outfitCardSubtitle: { fontSize: 9.5, lineHeight: 13, color: Colors.textLight, marginTop: 2, marginBottom: 7 },
  stage: { width: "100%", backgroundColor: Colors.background, borderRadius: 14, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 8 },
  stageCompact: { height: 235 },
  stageExpanded: { height: 390 },
  mainPieces: { flex: 1, alignItems: "center", justifyContent: "space-between" },
  fullPieceArea: { flex: 1, alignItems: "center", justifyContent: "center" },
  piece: { width: "100%", alignItems: "center", justifyContent: "center" },
  pieceCompact: { flex: 1, minHeight: 0 },
  pieceExpanded: { flex: 1, minHeight: 0 },
  clothingImage: { width: "76%", height: "100%" },
  fullImage: { width: "78%", height: "100%" },
  shoesImage: { width: "48%", height: "100%" },
  accessoryRow: { height: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingTop: 4 },
  accessoryBox: { width: 34, height: 34, borderRadius: 9, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center", padding: 3 },
  accessoryImage: { width: "100%", height: "100%" },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 6, minHeight: 18 },
  tapHint: { fontSize: 10.5, color: Colors.textLight },
  cardArrow: { fontSize: 13, color: Colors.textLight, marginLeft: 5 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", paddingHorizontal: 18, paddingVertical: 28 },
  modalCard: { width: "100%", maxWidth: 360, backgroundColor: "#FFFFFF", borderRadius: 24, padding: 15, shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 },
  modalTitleBlock: { flex: 1, paddingRight: 10 },
  modalEyebrow: { fontSize: 9, letterSpacing: 1.2, fontWeight: "700", color: Colors.textLight, marginBottom: 2 },
  modalTitle: { fontSize: 19, fontWeight: "700", color: Colors.text },
  modalSubtitle: { fontSize: 10.5, lineHeight: 14, color: Colors.textLight, marginTop: 3 },
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
});