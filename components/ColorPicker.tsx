import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import ReanimatedColorPicker, { HueSlider, Panel1 } from 'reanimated-color-picker';

import { BrandColors, Colors, Fonts, SemanticColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/lib/i18n';

type ColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
};

const isHexColor = (color: string) => /^#[0-9a-f]{6}$/i.test(color);

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [isModalVisible, setModalVisible] = useState(false);
  const [draftColor, setDraftColor] = useState(value);
  const isValidHex = isHexColor(value);
  const isDraftValid = isHexColor(draftColor);

  const openColorModal = () => {
    setDraftColor(isValidHex ? value : '#0B315B');
    setModalVisible(true);
  };

  const updateDraftColor = (text: string) => {
    const hex = text.startsWith('#') ? text : `#${text}`;
    setDraftColor(hex.slice(0, 7));
  };

  return (
    <View style={styles.container}>
      <View style={styles.customRow}>
        <Pressable
          onPress={openColorModal}
          style={[
            styles.preview,
            {
              backgroundColor: isValidHex ? value : '#D8E1E8',
              width: '100%',
              minHeight: 44,
              borderRadius: 8,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('accessibility.selectCustomColor')}
        />
      </View>

      <Modal animationType="fade" transparent visible={isModalVisible} onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalVisible(false)} accessibilityLabel={t('accessibility.closeColorPicker')} />
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('categories.pickerTitle')}</Text>
            <View style={[styles.modalPreview, { backgroundColor: isDraftValid ? draftColor : '#D8E1E8' }]} />
            <ReanimatedColorPicker
              value={isDraftValid ? draftColor : '#0B315B'}
              onChangeJS={({ hex }) => setDraftColor(hex)}
              sliderThickness={24}
              thumbSize={28}
              style={styles.visualPicker}>
              <Panel1 style={styles.colorPanel} />
              <HueSlider style={styles.hueSlider} />
            </ReanimatedColorPicker>
            <Text style={[styles.modalHint, { color: colors.icon }]}>{t('categories.colorHex')}</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={7}
              onChangeText={updateDraftColor}
              placeholder="#0B315B"
              placeholderTextColor={colors.icon}
              style={[styles.modalInput, { color: colors.text, borderColor: colors.icon }]}
              value={draftColor}
            />
            {!isDraftValid && <Text style={styles.errorText}>{t('validation.invalidColorFormat')}</Text>}
            <View style={styles.modalActions}>
              <Pressable onPress={() => setModalVisible(false)} style={[styles.button, styles.cancelButton, { borderColor: colors.icon }]}>
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                disabled={!isDraftValid}
                onPress={() => {
                  onChange(draftColor.toLowerCase());
                  setModalVisible(false);
                }}
                style={[styles.button, styles.confirmButton, !isDraftValid && styles.disabledButton]}>
                <Text style={styles.confirmButtonText}>{t('common.apply')}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  selected: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  preview: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  hexInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderRadius: 16,
    padding: 20,
    gap: 14,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
  },
  modalPreview: {
    height: 64,
    borderRadius: 12,
  },
  visualPicker: {
    gap: 16,
  },
  colorPanel: {
    width: '100%',
    height: 240,
    borderRadius: 12,
  },
  hueSlider: {
    width: '100%',
    borderRadius: 12,
  },
  modalHint: {
    fontSize: 14,
    fontFamily: Fonts.regular,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    fontFamily: Fonts.regular,
  },
  errorText: {
    color: SemanticColors.danger,
    fontSize: 13,
    fontFamily: Fonts.regular,
    marginTop: -8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  button: {
    minWidth: 96,
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  cancelButton: {
    borderWidth: 1,
  },
  confirmButton: {
    backgroundColor: BrandColors.navy,
  },
  disabledButton: {
    opacity: 0.5,
  },
  cancelButtonText: {
    fontFamily: Fonts.semiBold,
  },
  confirmButtonText: {
    color: '#fff', fontFamily: Fonts.bold,
  },
});
