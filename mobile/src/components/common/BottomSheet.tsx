import React, {useCallback, useRef, useEffect} from 'react';
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import {colors} from '../../constants/theme';

const {height: SCREEN_HEIGHT} = Dimensions.get('window');

// Snap positions as fractions of screen height from bottom
const SNAP_COLLAPSED = 0.15; // ~2 items visible
const SNAP_HALF = 0.45; // ~5 items
const SNAP_FULL = 0.85; // full screen minus status bar

interface BottomSheetProps {
  children: React.ReactNode;
  initialSnap?: 'collapsed' | 'half' | 'full';
}

export default function BottomSheet({
  children,
  initialSnap = 'collapsed',
}: BottomSheetProps) {
  const snapPoints = {
    collapsed: SCREEN_HEIGHT * (1 - SNAP_COLLAPSED),
    half: SCREEN_HEIGHT * (1 - SNAP_HALF),
    full: SCREEN_HEIGHT * (1 - SNAP_FULL),
  };

  const translateY = useRef(
    new Animated.Value(snapPoints[initialSnap]),
  ).current;
  const lastSnap = useRef(snapPoints[initialSnap]);

  const snapTo = useCallback(
    (toValue: number) => {
      lastSnap.current = toValue;
      Animated.spring(translateY, {
        toValue,
        damping: 20,
        stiffness: 150,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
    },
    [translateY],
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 5,
      onPanResponderMove: (_, gestureState) => {
        const newY = lastSnap.current + gestureState.dy;
        const clamped = Math.max(
          snapPoints.full,
          Math.min(snapPoints.collapsed, newY),
        );
        translateY.setValue(clamped);
      },
      onPanResponderRelease: (_, gestureState) => {
        const currentY = lastSnap.current + gestureState.dy;
        const velocity = gestureState.vy;

        // Determine nearest snap point, biased by velocity
        let target: number;
        if (velocity > 0.5) {
          // Swiping down — snap to next lower position
          if (currentY < snapPoints.half) {
            target = snapPoints.half;
          } else {
            target = snapPoints.collapsed;
          }
        } else if (velocity < -0.5) {
          // Swiping up — snap to next higher position
          if (currentY > snapPoints.half) {
            target = snapPoints.half;
          } else {
            target = snapPoints.full;
          }
        } else {
          // Low velocity — snap to nearest
          const distances = [
            {point: snapPoints.collapsed, dist: Math.abs(currentY - snapPoints.collapsed)},
            {point: snapPoints.half, dist: Math.abs(currentY - snapPoints.half)},
            {point: snapPoints.full, dist: Math.abs(currentY - snapPoints.full)},
          ];
          distances.sort((a, b) => a.dist - b.dist);
          target = distances[0].point;
        }

        snapTo(target);
      },
    }),
  ).current;

  useEffect(() => {
    snapTo(snapPoints[initialSnap]);
  }, [initialSnap, snapTo, snapPoints]);

  return (
    <Animated.View
      style={[
        styles.container,
        {transform: [{translateY}]},
      ]}
      {...panResponder.panHandlers}>
      {/* Pull handle */}
      <View style={styles.handleContainer}>
        <View style={styles.handle} />
      </View>

      {/* Content */}
      <View style={styles.content}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: SCREEN_HEIGHT,
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
