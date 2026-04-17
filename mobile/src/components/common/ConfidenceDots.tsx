import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTranslation} from 'react-i18next';

import {palette} from '../../constants/theme';
import {useTheme} from '../../hooks/useTheme';

export type ConfidenceLevel = 1 | 2 | 3 | 'low' | 'good' | 'verified';

type ConfidenceDotsProps = {
  level?: ConfidenceLevel;
  showLabel?: boolean;
  size?: number;
};

function normaliseLevel(level: ConfidenceLevel): 1 | 2 | 3 {
  if (level === 'verified' || level === 3) return 3;
  if (level === 'good' || level === 2) return 2;
  return 1;
}

const LABEL_KEY: Record<1 | 2 | 3, string> = {
  1: 'low',
  2: 'good',
  3: 'verified',
};

const LEVEL_COLOR: Record<1 | 2 | 3, string> = {
  1: palette.coral,
  2: palette.amber,
  3: palette.green,
};

/**
 * Confidence indicator per design handoff §6.3.
 *
 * Three small circles, coloured by level:
 *   1 (low)      → coral
 *   2 (good)     → amber
 *   3 (verified) → green
 *
 * Accepts both the new numeric API and the legacy string API so existing
 * callers (ETABadge, StopList, etc.) keep working unchanged.
 */
export default function ConfidenceDots({
  level = 2,
  showLabel = true,
  size = 6,
}: ConfidenceDotsProps) {
  const {t} = useTranslation();
  const {surface} = useTheme();
  const n = normaliseLevel(level);
  const color = LEVEL_COLOR[n];

  return (
    <View style={styles.row}>
      <View style={[styles.dots, {gap: Math.max(3, size / 2)}]}>
        {[1, 2, 3].map((i) => {
          const filled = i <= n;
          return (
            <View
              key={i}
              style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: filled ? color : 'transparent',
                borderColor: filled ? color : surface.hairline,
                borderWidth: filled ? 0 : 1,
              }}
            />
          );
        })}
      </View>
      {showLabel ? (
        <Text style={[styles.label, {color: surface.textDim}]}>
          {t(`map.confidence.${LABEL_KEY[n]}`)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center'},
  dots: {flexDirection: 'row'},
  label: {
    fontSize: 11,
    marginLeft: 6,
    fontWeight: '500',
  },
});
