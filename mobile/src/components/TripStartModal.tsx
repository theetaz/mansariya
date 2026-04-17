import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {BlurView} from 'expo-blur';
import {LinearGradient} from 'expo-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {useTranslation} from 'react-i18next';

import {palette, radii, spacing} from '../constants/theme';
import {useTheme} from '../hooks/useTheme';
import {RouteBadge} from './common/RouteBadge';
import {useMapStore} from '../stores/useMapStore';
import {searchRoutesOffline} from '../services/offlineDb';

type CrowdLevel = 1 | 2 | 3 | 4;

type TripStartModalProps = {
  visible: boolean;
  onStart: (meta: {
    routeId?: string;
    busNumber?: string;
    crowdLevel?: number;
  }) => void;
  onSkip: () => void;
  onCancel: () => void;
};

type CrowdSpec = {
  v: CrowdLevel;
  dot: string;
  label: string;
  sub: string;
};

const CROWD_LEVELS: readonly CrowdSpec[] = [
  {v: 1, dot: palette.green, label: 'Empty', sub: 'seats free'},
  {v: 2, dot: '#B6C44F', label: 'Some', sub: 'half full'},
  {v: 3, dot: palette.amber, label: 'Packed', sub: 'standing'},
  {v: 4, dot: palette.coral, label: 'Full', sub: 'no room'},
];

/**
 * Share-your-ride bottom sheet.
 *
 * Design handoff: screens-trip-start.jsx. Replaces the old form-heavy
 * TripStartModal with a warmer, streamlined flow:
 *   1. Amber→coral gradient signal tile + title ("Share your ride")
 *   2. Pre-filled detected route (tap to change)
 *   3. Four crowd-level cards with stacked-bar visuals
 *   4. Collapsed "Add bus plate" row
 *   5. Emerald-gradient "● Start sharing" CTA with pulsing dot
 *   6. "Share without details" ghost action
 */
export default function TripStartModal({
  visible,
  onStart,
  onSkip,
  onCancel,
}: TripStartModalProps) {
  const {t} = useTranslation();
  const {isDark, surface} = useTheme();
  const insets = useSafeAreaInsets();

  // Detected route from the map store (inferred from the nearest bus or the
  // spatial index). Falls back to manual entry if nothing detected.
  const detectedRouteId = useDetectedRouteId();
  const [detectedRouteName, setDetectedRouteName] = useState<string | null>(
    null,
  );

  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(
    detectedRouteId,
  );
  const [selectedRouteName, setSelectedRouteName] = useState<string | null>(
    null,
  );
  const [crowdLevel, setCrowdLevel] = useState<CrowdLevel | null>(null);
  const [busNumber, setBusNumber] = useState<string>('');

  // Resolve the display name for the detected / selected route.
  useEffect(() => {
    const id = selectedRouteId ?? detectedRouteId;
    if (!id) {
      setSelectedRouteName(null);
      setDetectedRouteName(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const results = (await searchRoutesOffline(id, 1)) as Array<{
        id: string;
        name_en: string;
      }>;
      if (cancelled) return;
      const match = results.find((r) => r.id === id) ?? results[0];
      const name = match?.name_en ?? null;
      setSelectedRouteName(name);
      if (id === detectedRouteId) setDetectedRouteName(name);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedRouteId, detectedRouteId]);

  // Reset when the sheet opens so we always start from the freshest
  // detected route.
  useEffect(() => {
    if (visible) {
      setSelectedRouteId(detectedRouteId);
      setCrowdLevel(null);
      setBusNumber('');
    }
  }, [visible, detectedRouteId]);

  const handleStart = useCallback(() => {
    onStart({
      routeId: selectedRouteId ?? undefined,
      busNumber: busNumber.trim() || undefined,
      crowdLevel: crowdLevel ?? undefined,
    });
  }, [busNumber, crowdLevel, onStart, selectedRouteId]);

  const handleSkip = useCallback(() => {
    onSkip();
  }, [onSkip]);

  // Pulsing dot inside the primary CTA.
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, {duration: 1400, easing: Easing.inOut(Easing.ease)}),
      -1,
      true,
    );
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.35,
    transform: [{scale: 1 + pulse.value * 0.8}],
  }));

  const routeName = selectedRouteName ?? detectedRouteName;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onCancel}
      statusBarTranslucent>
      <View style={styles.overlay}>
        {/* Scrim — tap outside to cancel */}
        <Pressable style={styles.scrim} onPress={onCancel}>
          <LinearGradient
            colors={
              isDark
                ? ['rgba(7,17,13,0.1)', 'rgba(7,17,13,0.7)', 'rgba(7,17,13,0.85)']
                : ['rgba(10,20,15,0)', 'rgba(10,20,15,0.28)', 'rgba(10,20,15,0.42)']
            }
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.dismissHint, {top: insets.top + 24}]}>
            <Text
              style={[
                styles.dismissHintText,
                {color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.9)'},
              ]}>
              {t(
                'trip_start.tap_outside',
                'Tap anywhere outside to cancel',
              )}
            </Text>
          </View>
        </Pressable>

        {/* Sheet */}
        <View style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <BlurView
              intensity={Platform.OS === 'ios' ? 80 : 40}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                StyleSheet.absoluteFill,
                {backgroundColor: surface.glassBg},
              ]}
            />

            <View
              style={[
                styles.sheetContent,
                {paddingBottom: 34 + insets.bottom * 0.5},
              ]}>
              {/* Grabber */}
              <View
                style={[
                  styles.grabber,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.22)'
                      : 'rgba(0,0,0,0.18)',
                  },
                ]}
              />

              {/* Header: signal tile + title + close */}
              <View style={styles.header}>
                <LinearGradient
                  colors={[palette.amber, palette.coral]}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 1}}
                  style={styles.signalTile}>
                  <Ionicons name="wifi" size={20} color="#FFFFFF" />
                </LinearGradient>
                <View style={{flex: 1}}>
                  <Text style={[styles.title, {color: surface.text}]}>
                    {t('trip_start.title', 'Share your ride')}
                  </Text>
                  <Text
                    style={[styles.subtitle, {color: surface.textDim}]}
                    numberOfLines={2}>
                    {t(
                      'trip_start.subtitle',
                      'Anonymous · stop any time · helps ~40 riders per trip',
                    )}
                  </Text>
                </View>
                <Pressable
                  onPress={onCancel}
                  hitSlop={8}
                  style={({pressed}) => [
                    styles.closeBtn,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(0,0,0,0.05)',
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}>
                  <Ionicons name="close" size={14} color={surface.textDim} />
                </Pressable>
              </View>

              {/* YOUR ROUTE */}
              <View style={styles.sectionRow}>
                <Text style={[styles.eyebrow, {color: surface.textDim}]}>
                  {t('trip_start.your_route', 'YOUR ROUTE')}
                </Text>
                <Pressable hitSlop={6}>
                  <Text style={styles.eyebrowAction}>
                    {t('trip_start.change', 'Change')}
                  </Text>
                </Pressable>
              </View>

              <View
                style={[
                  styles.routeCard,
                  {
                    backgroundColor: isDark
                      ? 'rgba(29,158,117,0.12)'
                      : 'rgba(29,158,117,0.08)',
                    borderColor: isDark
                      ? 'rgba(29,158,117,0.35)'
                      : 'rgba(29,158,117,0.28)',
                  },
                ]}>
                {selectedRouteId ? (
                  <RouteBadge
                    num={selectedRouteId}
                    color={palette.emerald}
                    size="md"
                  />
                ) : (
                  <View
                    style={[
                      styles.routeBadgePlaceholder,
                      {backgroundColor: surface.bgAlt},
                    ]}>
                    <Text style={{color: surface.textDim, fontSize: 12}}>
                      ?
                    </Text>
                  </View>
                )}
                <View style={{flex: 1}}>
                  <Text
                    style={[styles.routeName, {color: surface.text}]}
                    numberOfLines={1}>
                    {routeName ??
                      t('trip_start.pick_route', 'Tap to pick a route')}
                  </Text>
                  {selectedRouteId === detectedRouteId && detectedRouteId ? (
                    <View style={styles.detectedRow}>
                      <Ionicons
                        name="sparkles"
                        size={11}
                        color={palette.green}
                      />
                      <Text style={styles.detectedText}>
                        {t(
                          'trip_start.detected',
                          'Detected near your location',
                        )}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={surface.textDim}
                />
              </View>

              {/* HOW CROWDED */}
              <View style={[styles.sectionRow, {marginTop: 18}]}>
                <Text style={[styles.eyebrow, {color: surface.textDim}]}>
                  {t('trip_start.how_crowded', 'HOW CROWDED')}
                </Text>
                <Text
                  style={[styles.optionalLabel, {color: surface.textSoft}]}>
                  {t('trip_start.optional', 'Optional')}
                </Text>
              </View>
              <View style={styles.crowdGrid}>
                {CROWD_LEVELS.map((c, idx) => {
                  const active = crowdLevel === c.v;
                  const cardStyle = {
                    flex: 1,
                    marginLeft: idx === 0 ? 0 : 6,
                    paddingVertical: 10,
                    paddingHorizontal: 4,
                    borderRadius: 14,
                    backgroundColor: active
                      ? isDark
                        ? 'rgba(255,255,255,0.10)'
                        : '#FFFFFF'
                      : isDark
                        ? 'rgba(255,255,255,0.04)'
                        : 'rgba(0,0,0,0.03)',
                    borderWidth: active ? 1.5 : StyleSheet.hairlineWidth,
                    borderColor: active ? c.dot : surface.hairline,
                    alignItems: 'center' as const,
                    shadowColor: active ? c.dot : 'transparent',
                    shadowOffset: {width: 0, height: 4},
                    shadowOpacity: active ? 0.18 : 0,
                    shadowRadius: 12,
                    elevation: active ? 3 : 0,
                  };
                  return (
                    <Pressable
                      key={c.v}
                      onPress={() => setCrowdLevel(active ? null : c.v)}
                      style={cardStyle}>
                      <View style={styles.crowdBars}>
                        {[0, 1, 2, 3].map((i) => {
                          const on = i < c.v;
                          return (
                            <View
                              key={i}
                              style={{
                                width: 5,
                                height: 9,
                                borderRadius: 2.5,
                                marginHorizontal: 1,
                                backgroundColor: on
                                  ? c.dot
                                  : isDark
                                    ? 'rgba(255,255,255,0.15)'
                                    : 'rgba(0,0,0,0.10)',
                              }}
                            />
                          );
                        })}
                      </View>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          letterSpacing: -0.1,
                          color: active ? surface.text : surface.textDim,
                        }}>
                        {t(
                          `trip_start.crowd_${c.label.toLowerCase()}`,
                          c.label,
                        )}
                      </Text>
                      <Text
                        style={{
                          fontSize: 9,
                          marginTop: 1,
                          fontWeight: '500',
                          color: surface.textSoft,
                        }}>
                        {c.sub}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Add bus plate — collapsed row */}
              <Pressable
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 14,
                  paddingVertical: 11,
                  borderRadius: 14,
                  marginTop: 18,
                  marginBottom: 18,
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(0,0,0,0.03)',
                }}>
                <Ionicons name="add" size={14} color={surface.textDim} />
                <Text
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: '500',
                    color: surface.textDim,
                    marginLeft: 10,
                  }}
                  numberOfLines={1}>
                  {t('trip_start.add_plate', 'Add bus plate')}{' '}
                  <Text style={{color: surface.textSoft}}>
                    · {t('trip_start.plate_example', 'NB-1234')}
                  </Text>
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={surface.textSoft}
                />
              </Pressable>

              {/* Primary CTA — emerald gradient with pulsing dot */}
              <Pressable
                onPress={handleStart}
                style={({pressed}) => [
                  styles.primaryBtn,
                  {transform: [{scale: pressed ? 0.98 : 1}]},
                ]}>
                <LinearGradient
                  colors={[palette.green, palette.emerald]}
                  start={{x: 0, y: 0}}
                  end={{x: 0, y: 1}}
                  style={StyleSheet.absoluteFill}
                />
                {/* Inner top highlight */}
                <View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      borderTopLeftRadius: 18,
                      borderTopRightRadius: 18,
                      borderTopWidth: 1,
                      borderTopColor: 'rgba(255,255,255,0.25)',
                    },
                  ]}
                />
                <View style={styles.liveDotWrap}>
                  <Animated.View
                    style={[styles.liveDotHalo, pulseStyle]}
                  />
                  <View style={styles.liveDotCore} />
                </View>
                <Text style={styles.primaryLabel}>
                  {t('trip_start.start_sharing', 'Start sharing')}
                </Text>
              </Pressable>

              {/* Share without details */}
              <Pressable
                onPress={handleSkip}
                hitSlop={8}
                style={({pressed}) => ({
                  alignSelf: 'center',
                  marginTop: 10,
                  padding: 6,
                  opacity: pressed ? 0.6 : 1,
                })}>
                <Text
                  style={[
                    styles.skipLabel,
                    {color: surface.textDim},
                  ]}>
                  {t(
                    'trip_start.share_without_details',
                    'Share without details',
                  )}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Best guess at the route the user is currently on — takes the most
 * recently-seen bus near the user's location from the map store. This is
 * just a hint; users can override.
 */
function useDetectedRouteId(): string | null {
  const buses = useMapStore((s) => s.buses);
  return useMemo(() => {
    const entries = Object.values(buses);
    if (entries.length === 0) return null;
    // Prefer the highest-confidence bus. In the absence of a spatial join
    // we just take the first — the map store is already scoped to the
    // current viewport.
    const sorted = [...entries].sort((a, b) => {
      const rank = (c: typeof a.confidence) =>
        c === 'verified' ? 3 : c === 'good' ? 2 : 1;
      return rank(b.confidence) - rank(a.confidence);
    });
    return sorted[0].route_id;
  }, [buses]);
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  dismissHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  dismissHintText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },

  sheetWrap: {
    width: '100%',
  },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  sheetContent: {
    paddingHorizontal: 22,
    paddingTop: 12,
  },

  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 16,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 18,
  },
  signalTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.amber,
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.33,
    shadowRadius: 16,
    elevation: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  eyebrowAction: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.green,
  },
  optionalLabel: {
    fontSize: 11,
    fontWeight: '600',
  },

  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  routeBadgePlaceholder: {
    width: 48,
    height: 30,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeName: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  detectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  detectedText: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.green,
  },

  crowdGrid: {
    flexDirection: 'row',
  },
  crowdBars: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 6,
  },

  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    marginTop: 18,
    marginBottom: 18,
  },
  addRowText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },

  primaryBtn: {
    height: 54,
    borderRadius: 18,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: palette.emerald,
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.33,
    shadowRadius: 24,
    elevation: 8,
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  liveDotWrap: {
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDotHalo: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  liveDotCore: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FFFFFF',
  },

  skipLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
});
