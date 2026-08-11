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

  throw new Error("Could not determine the local backend address. Set EXPO_PUBLIC_BACKEND_URL or restart Expo Go.");
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
      const userId = user?.id;
      if (typeof userId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
        throw new Error("Your Supabase session returned an invalid user ID. Please sign out and sign in again.");
      }

      const conversationHistory = messages.map((item) => ({ role: item.type === "user" ? "user" : "assistant", content: item.text || "" }));
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
          const { data, error: wardrobeError } = await supabase.from("clothing_items").select("id, image_url, normalized_image_url, category, subcategory, description").in("id", uniqueItemIds);
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
      setMessages((current) => [...current, { id: `error-${Date.now()}`, type: "assistant", text: error.message || "Sorry, I couldn't create your outfit right now. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenOutfit = (outfitNumber, items) => setExpandedOutfit({ key: `${outfitNumber}-${Date.now()}`, outfitNumber, items });
  const handleSaveExpandedOutfit = () => {
    if (!expandedOutfit) return;
    setSavedOutfits((current) => ({ ...current, [expandedOutfit.key]: true }));
  };
  const handleRetry = () => {
    setExpandedOutfit(null);
    if (lastMessage) handleSend(lastMessage);
  };

  // The rest of the existing render and styles remain unchanged.
