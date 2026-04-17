import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {palette, radii, serviceTypeColors, typography} from '../../constants/theme';

export type RouteBadgeSize = 'sm' | 'md' | 'lg';
export type RouteBadgeService = keyof typeof serviceTypeColors;

type RouteBadgeProps = {
  num: string | number;
  /** Override the auto color picked from serviceType. */
  color?: string;
  service?: RouteBadgeService;
  size?: RouteBadgeSize;
  /** Render as a dark-on-light "soft" pill instead of filled. */
  soft?: boolean;
};

const SIZE = {
  sm: {height: 24, minWidth: 40, paddingX: 8, radius: radii.sm, font: 12, letter: 0.3},
  md: {height: 30, minWidth: 48, paddingX: 10, radius: radii.md, font: 14, letter: 0.3},
  lg: {height: 38, minWidth: 58, paddingX: 14, radius: radii.lg, font: 18, letter: 0.4},
} as const;

/**
 * Route number badge per design handoff §6.2.
 *
 * Filled pill, route number in white, coloured by `serviceType` (or `color`).
 * Includes a 1px inner-top highlight and a coloured glow so the badge feels
 * like a tactile iOS-26-style pill.
 */
export function RouteBadge({
  num,
  color,
  service = 'Normal',
  size = 'md',
  soft = false,
}: RouteBadgeProps) {
  const dims = SIZE[size];
  const scheme = serviceTypeColors[service] ?? serviceTypeColors.Normal;
  const fill = color ?? scheme.text;
  const textColor = soft ? scheme.text : '#FFFFFF';
  const bg = soft ? scheme.bg : fill;

  return (
    <View
      style={[
        styles.badge,
        {
          height: dims.height,
          minWidth: dims.minWidth,
          paddingHorizontal: dims.paddingX,
          borderRadius: dims.radius,
          backgroundColor: bg,
          shadowColor: fill,
        },
      ]}>
      {/* Inner top highlight — 1px line that sells the pill depth. */}
      {!soft ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderTopWidth: 1,
              borderTopColor: 'rgba(255,255,255,0.55)',
              borderRadius: dims.radius,
            },
          ]}
        />
      ) : null}

      <Text
        numberOfLines={1}
        style={{
          color: textColor,
          fontSize: dims.font,
          fontWeight: '700',
          letterSpacing: dims.letter,
          includeFontPadding: false,
        }}>
        {num}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    // Glow — on iOS this paints a coloured soft halo around the badge.
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
});

// ── Back-compat wrapper ────────────────────────────────────────────────────
// Maps the older `routeNumber + size: 'small' | 'large'` API onto RouteBadge.
type LegacyRouteNumberBadgeProps = {
  routeNumber: string;
  serviceType?: RouteBadgeService;
  size?: 'small' | 'large';
};

export default function RouteNumberBadge({
  routeNumber,
  serviceType = 'Normal',
  size = 'small',
}: LegacyRouteNumberBadgeProps) {
  return (
    <RouteBadge
      num={routeNumber}
      service={serviceType}
      size={size === 'large' ? 'lg' : 'sm'}
    />
  );
}

// Keep the typography reference live (used by some callers that want to
// align numbers next to this badge without re-importing theme).
export const routeBadgeTypography = typography.routeNumberCard;
export const routeBadgeLargeTypography = typography.routeNumberLarge;
export const routeBadgeInk = palette.ink;
