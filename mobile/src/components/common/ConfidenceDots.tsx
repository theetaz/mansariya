import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useTranslation} from 'react-i18next';
import {colors} from '../../constants/theme';

interface ConfidenceDotsProps {
  level: 'low' | 'good' | 'verified';
  showLabel?: boolean;
}

export default function ConfidenceDots({
  level,
  showLabel = true,
}: ConfidenceDotsProps) {
  const {t} = useTranslation();

  const filledCount = level === 'verified' ? 3 : level === 'good' ? 2 : 1;
  const dotColor =
    level === 'low' ? colors.confidenceApproximate : colors.confidenceVerified;

  return (
    <View style={styles.container}>
      <View style={styles.dots}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < filledCount
                ? {backgroundColor: dotColor}
                : styles.dotEmpty,
            ]}
          />
        ))}
      </View>
      {showLabel && (
        <Text style={styles.label}>
          {t(`map.confidence.${level}`)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.neutral300,
  },
  label: {
    fontSize: 10,
    color: colors.neutral500,
    marginLeft: 6,
  },
});
