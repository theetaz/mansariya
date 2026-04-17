import React, {useEffect} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import {palette, radii} from '../../constants/theme';

type LiveBadgeKind = 'live' | 'arriving' | 'reporting' | 'custom';

type LiveBadgeProps = {
  kind?: LiveBadgeKind;
  label?: string;
  color?: string;
  /** Dim the badge when the amber signal doesn't apply (e.g. stale). */
  muted?: boolean;
  compact?: boolean;
};

const KIND_LABEL: Record<Exclude<LiveBadgeKind, 'custom'>, string> = {
  live: 'LIVE',
  arriving: 'Arriving',
  reporting: 'Reporting',
};

/**
 * Pulsing amber pill per design handoff §6.4.
 *
 * Used anywhere we signal that a human contributor is making the feed real:
 *   - bus marker "LIVE"
 *   - stop row "Arriving now"
 *   - trip HUD "You're reporting · 27 pings"
 *
 * Amber is RESERVED for this meaning — do not repurpose for warnings.
 */
export function LiveBadge({
  kind = 'live',
  label,
  color = palette.amber,
  muted = false,
  compact = false,
}: LiveBadgeProps) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, {duration: 1400, easing: Easing.inOut(Easing.ease)}),
      -1,
      true,
    );
  }, [pulse]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.35,
    transform: [{scale: 1 + pulse.value * 0.8}],
  }));

  const text = label ?? (kind === 'custom' ? '' : KIND_LABEL[kind]);
  const paintColor = muted ? palette.ink : color;
  const pillBg = muted ? 'rgba(10,20,15,0.06)' : 'rgba(232,154,60,0.14)';

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: pillBg,
          paddingHorizontal: compact ? 8 : 10,
          paddingVertical: compact ? 3 : 4,
        },
      ]}>
      <View style={styles.dotWrap}>
        <Animated.View
          style={[
            styles.halo,
            {backgroundColor: paintColor, opacity: 0.35},
            haloStyle,
          ]}
        />
        <View style={[styles.dot, {backgroundColor: paintColor}]} />
      </View>
      {text ? (
        <Text
          style={[
            styles.label,
            {color: paintColor, fontSize: compact ? 10 : 11},
          ]}>
          {text.toUpperCase()}
        </Text>
      ) : null}
    </View>
  );
}

const DOT = 7;
const HALO = 14;

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  dotWrap: {
    width: HALO,
    height: HALO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: HALO,
    height: HALO,
    borderRadius: HALO / 2,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
  label: {
    marginLeft: 6,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
});

export default LiveBadge;
