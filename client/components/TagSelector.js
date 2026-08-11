import { StyleSheet, Text, View, TextInput, Pressable } from 'react-native';
import { useState } from 'react';
import Colors from '../constants/colors';
import Spacing from '../constants/spacing';

export default function TagSelector({
  options,
  selected,
  onChange,
  exclusiveOption,
  allowCustom = false,
}) {
  const [customText, setCustomText] = useState('');

  const isExclusiveSelected = exclusiveOption && selected.includes(exclusiveOption);

  const toggleTag = (tag) => {
    if (tag === exclusiveOption) {
      onChange(isExclusiveSelected ? [] : [exclusiveOption]);
      return;
    }
    const withoutExclusive = selected.filter((t) => t !== exclusiveOption);
    onChange(
      withoutExclusive.includes(tag)
        ? withoutExclusive.filter((t) => t !== tag)
        : [...withoutExclusive, tag]
    );
  };

  const addCustomTag = () => {
    const trimmed = customText.trim();
    if (trimmed && !selected.includes(trimmed)) {
      onChange([...selected.filter((t) => t !== exclusiveOption), trimmed]);
    }
    setCustomText('');
  };

  return (
    <View>
      <View style={styles.tagContainer}>
        {options.map((tag) => {
          const isSelected = selected.includes(tag);
          const isDisabled = isExclusiveSelected && tag !== exclusiveOption;
          return (
            <Pressable
              key={tag}
              style={[styles.tag, isSelected && styles.tagSelected, isDisabled && styles.tagDisabled]}
              onPress={() => toggleTag(tag)}
              disabled={isDisabled}
            >
              <Text style={[styles.tagText, isSelected && styles.tagTextSelected, isDisabled && styles.tagTextDisabled]}>
                {tag}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {allowCustom && (
        <View style={styles.customRow}>
          <TextInput
            style={[styles.input, isExclusiveSelected && styles.inputDisabled]}
            value={customText}
            onChangeText={setCustomText}
            placeholder="Type your own"
            placeholderTextColor={Colors.textLight}
            onSubmitEditing={addCustomTag}
            returnKeyType="done"
            editable={!isExclusiveSelected}
          />
          <Pressable
            style={[styles.addButton, isExclusiveSelected && styles.addButtonDisabled]}
            onPress={addCustomTag}
            disabled={isExclusiveSelected}
          >
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tagContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tag: {
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  tagSelected: { backgroundColor: Colors.primary },
  tagDisabled: { borderColor: Colors.border, backgroundColor: Colors.accent },
  tagText: { color: Colors.primary, fontWeight: '500', fontSize: 14 },
  tagTextSelected: { color: '#fff' },
  tagTextDisabled: { color: Colors.textLight },
  customRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', marginTop: Spacing.md },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Spacing.radiusMedium,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
  },
  inputDisabled: { backgroundColor: Colors.accent, color: Colors.textLight },
  addButton: { backgroundColor: Colors.primary, paddingVertical: 14, paddingHorizontal: Spacing.lg, borderRadius: Spacing.radiusMedium },
  addButtonDisabled: { backgroundColor: Colors.border },
  addButtonText: { color: '#fff', fontWeight: '600' },
});