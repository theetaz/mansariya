import React from 'react';
import {View, StyleSheet, Dimensions} from 'react-native';
import {colors} from '../../constants/theme';

const {height: SCREEN_HEIGHT} = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.22; // collapsed height showing ~2 items

interface BottomSheetProps {
  children: React.ReactNode;
}

/**
 * Simple static bottom sheet.
 * Shows a fixed panel at the bottom of the screen with a pull handle.
 * Full gesture-based sheet will be added when react-native-reanimated is integrated.
 */
export default function BottomSheet({children}: BottomSheetProps) {
  return (
    <View style={styles.container}>
      {/* Pull handle */}
      <View style={styles.handleContainer}>
        <View style={styles.handle} />
      </View>

      {/* Content */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -3},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral300,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
});

export {SHEET_HEIGHT};
