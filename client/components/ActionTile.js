import { Pressable, Text, StyleSheet } from "react-native";
import Colors from "../constants/colors";
import Spacing from "../constants/spacing";

export default function ActionTile({ emoji, title, onPress }) {
  return (
    <Pressable style={styles.tile} onPress={onPress}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.title}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Spacing.radiusLarge,
    paddingVertical: 24,
    alignItems: "center",

    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 5,
    },

    elevation: 2,
  },

  emoji: {
    fontSize: 34,
    marginBottom: 12,
  },

  title: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
    textAlign: "center",
  },
});