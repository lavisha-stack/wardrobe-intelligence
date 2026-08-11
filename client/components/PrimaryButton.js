import { Pressable, Text, StyleSheet } from "react-native";
import Colors from "../constants/colors";

export default function PrimaryButton({ title, onPress, disabled = false }) {
  return (
    <Pressable
      style={[styles.button, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 999,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  text: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
});