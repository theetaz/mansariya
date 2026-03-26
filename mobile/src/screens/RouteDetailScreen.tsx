import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../navigation/types';
import {fetchRouteDetail, Route, Stop} from '../services/api';
import {useSavedStore} from '../stores/useSavedStore';
import {useBusPositions} from '../hooks/useBusPositions';

export default function RouteDetailScreen() {
  const {t} = useTranslation();
  const route = useRoute<RouteProp<RootStackParamList, 'RouteDetail'>>();
  const {routeId} = route.params;

  const [routeData, setRouteData] = useState<Route | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);

  const addRoute = useSavedStore((s) => s.addRoute);
  const removeRoute = useSavedStore((s) => s.removeRoute);
  const isSaved = useSavedStore((s) => s.isSaved(routeId));

  // Subscribe to live bus positions
  useBusPositions(routeId);

  useEffect(() => {
    loadRoute();
  }, [routeId]);

  const loadRoute = async () => {
    try {
      const data = await fetchRouteDetail(routeId);
      setRouteData(data.route);
      setStops(data.stops || []);
    } catch {
      // TODO: try offline fallback
    } finally {
      setLoading(false);
    }
  };

  const toggleSaved = () => {
    if (!routeData) return;
    if (isSaved) {
      removeRoute(routeId);
    } else {
      addRoute(routeData);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!routeData) {
    return (
      <View style={styles.centered}>
        <Text>{t('common.error')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Route header */}
      <View style={styles.header}>
        <View style={styles.routeNumber}>
          <Text style={styles.routeNumberText}>{routeData.id}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.routeName}>{routeData.name_en}</Text>
          <Text style={styles.routeNameLocal}>{routeData.name_si}</Text>
          {routeData.fare_lkr && (
            <Text style={styles.fare}>
              {t('route.fare')}: LKR {routeData.fare_lkr}
            </Text>
          )}
          {routeData.frequency_minutes && (
            <Text style={styles.frequency}>
              {t('route.frequency', {minutes: routeData.frequency_minutes})}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={toggleSaved} style={styles.saveButton}>
          <Text style={styles.saveIcon}>{isSaved ? '★' : '☆'}</Text>
        </TouchableOpacity>
      </View>

      {/* Stops list */}
      <Text style={styles.stopsTitle}>
        {t('route.stops')} ({stops.length})
      </Text>
      <FlatList
        data={stops}
        keyExtractor={(item) => item.id}
        renderItem={({item, index}) => (
          <View style={styles.stopItem}>
            <View style={styles.stopDot}>
              <View
                style={[
                  styles.dot,
                  index === 0 && styles.dotFirst,
                  index === stops.length - 1 && styles.dotLast,
                ]}
              />
              {index < stops.length - 1 && <View style={styles.stopLine} />}
            </View>
            <View style={styles.stopInfo}>
              <Text style={styles.stopName}>{item.name_en}</Text>
              {item.name_si && (
                <Text style={styles.stopNameLocal}>{item.name_si}</Text>
              )}
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  centered: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  header: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  routeNumber: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
  },
  routeNumberText: {color: '#fff', fontSize: 24, fontWeight: '700'},
  headerInfo: {flex: 1},
  routeName: {fontSize: 18, fontWeight: '700', color: '#333'},
  routeNameLocal: {fontSize: 15, color: '#666', marginTop: 2},
  fare: {fontSize: 13, color: '#16A34A', marginTop: 4},
  frequency: {fontSize: 13, color: '#999', marginTop: 2},
  saveButton: {padding: 8},
  saveIcon: {fontSize: 28, color: '#F59E0B'},
  stopsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    padding: 16,
    paddingBottom: 8,
    textTransform: 'uppercase',
  },
  stopItem: {flexDirection: 'row', paddingHorizontal: 16},
  stopDot: {width: 24, alignItems: 'center'},
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2563EB',
    marginTop: 4,
  },
  dotFirst: {backgroundColor: '#16A34A'},
  dotLast: {backgroundColor: '#DC2626'},
  stopLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#e0e0e0',
    marginTop: 2,
    marginBottom: 2,
  },
  stopInfo: {flex: 1, paddingBottom: 16, paddingLeft: 8},
  stopName: {fontSize: 16, fontWeight: '500', color: '#333'},
  stopNameLocal: {fontSize: 13, color: '#999', marginTop: 1},
});
