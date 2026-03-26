import React, {useMemo, useRef} from 'react';
import {StyleSheet} from 'react-native';
import GorhomBottomSheet, {BottomSheetScrollView} from '@gorhom/bottom-sheet';
import {colors} from '../../constants/theme';

interface BottomSheetProps {
  children: React.ReactNode;
}

/**
 * Expandable bottom sheet using @gorhom/bottom-sheet.
 * 3 snap points: collapsed (~18%), half (~45%), full (~85%).
 * Swipe up to expand, swipe down to collapse.
 */
export default function BottomSheet({children}: BottomSheetProps) {
  const bottomSheetRef = useRef<GorhomBottomSheet>(null);
  const snapPoints = useMemo(() => ['18%', '45%', '85%'], []);

  return (
    <GorhomBottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.background}
      style={styles.shadow}>
      <BottomSheetScrollView style={styles.content}>
        {children}
      </BottomSheetScrollView>
    </GorhomBottomSheet>
  );
}

// Approximate collapsed height for FAB positioning
export const SHEET_HEIGHT = 140;

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
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
  shadow: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -3},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
});
