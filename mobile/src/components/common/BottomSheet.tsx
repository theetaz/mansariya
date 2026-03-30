import React, {useState} from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
} from 'react-native';
import {colors} from '../../constants/theme';
import {useTheme} from '../../hooks/useTheme';

const {height: SCREEN_HEIGHT} = Dimensions.get('window');

interface BottomSheetProps {
  children: React.ReactNode;
}

/**
 * Simple expandable bottom sheet.
 * Tap the handle area to toggle between collapsed and expanded.
 * Scrollable content when expanded.
 */
export default function BottomSheet({children}: BottomSheetProps) {
  const [expanded, setExpanded] = useState(false);
  const {colors: tc} = useTheme();
  const sheetHeight = expanded ? SCREEN_HEIGHT * 0.6 : COLLAPSED_HEIGHT;

  return (
    <View style={[styles.container, {height: sheetHeight, backgroundColor: tc.card, borderTopColor: tc.border}]}>
      {/* Pull handle — tap to toggle */}
      <TouchableOpacity
        style={styles.handleArea}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.8}>
        <View style={[styles.handle, {backgroundColor: tc.border}]} />
        {expanded && (
          <Text style={[styles.collapseHint, {color: tc.textTertiary}]}>Tap to collapse</Text>
        )}
      </TouchableOpacity>

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEnabled={expanded}>
        {children}
      </ScrollView>
    </View>
  );
}

const COLLAPSED_HEIGHT = SCREEN_HEIGHT * 0.22;
export const SHEET_HEIGHT = COLLAPSED_HEIGHT;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -3},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  handleArea: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral300,
  },
  collapseHint: {
    fontSize: 10,
    color: colors.neutral300,
    marginTop: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
});
