import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {colors, spacing} from '../../constants/theme';
import RouteNumberBadge from '../common/RouteNumberBadge';
import ETABadge from '../common/ETABadge';

interface RouteCardProps {
  routeNumber: string;
  destination: string;
  via?: string;
  operator?: string;
  serviceType?: 'Normal' | 'Semi Luxury' | 'AC Luxury';
  etaMinutes?: number;
  isLive?: boolean;
  onPress?: () => void;
}

export default function RouteCard({
  routeNumber,
  destination,
  via,
  operator,
  serviceType = 'Normal',
  etaMinutes,
  isLive = false,
  onPress,
}: RouteCardProps) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}>
      <RouteNumberBadge routeNumber={routeNumber} serviceType={serviceType} />

      <View style={styles.info}>
        <Text style={styles.destination} numberOfLines={1}>
          {destination}
        </Text>
        {via ? (
          <Text style={styles.via} numberOfLines={1}>
            via {via}
          </Text>
        ) : operator ? (
          <Text style={styles.via} numberOfLines={1}>
            {operator}
            {serviceType !== 'Normal' ? ` · ${serviceType}` : ''}
          </Text>
        ) : null}
      </View>

      {etaMinutes != null && (
        <ETABadge minutes={etaMinutes} isLive={isLive} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.neutral200,
    gap: spacing.md,
  },
  info: {
    flex: 1,
  },
  destination: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral900,
  },
  via: {
    fontSize: 12,
    color: colors.neutral500,
    marginTop: 2,
  },
});
