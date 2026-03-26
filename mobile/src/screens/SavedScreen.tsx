import React from 'react';
import {View, FlatList, Text, StyleSheet} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/types';
import {useSavedStore} from '../stores/useSavedStore';
import {colors, spacing, typography} from '../constants/theme';
import RouteCard from '../components/route/RouteCard';

export default function SavedScreen() {
  const {t} = useTranslation();
  const savedRoutes = useSavedStore((s) => s.savedRoutes);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>{t('saved.title')}</Text>

      <FlatList
        data={savedRoutes}
        keyExtractor={(item) => item.id}
        renderItem={({item}) => (
          <RouteCard
            routeNumber={item.id}
            destination={item.name_en}
            operator={item.operator}
            serviceType={item.service_type as any}
            onPress={() =>
              navigation.navigate('RouteDetail', {routeId: item.id})
            }
          />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>⭐</Text>
            <Text style={styles.emptyTitle}>{t('saved.empty')}</Text>
            <Text style={styles.emptyHint}>{t('saved.add_hint')}</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.neutral900,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  list: {paddingHorizontal: spacing.lg},
  emptyState: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  emptyIcon: {fontSize: 48, marginBottom: spacing.lg},
  emptyTitle: {
    ...typography.h2,
    color: colors.neutral900,
    marginBottom: spacing.sm,
  },
  emptyHint: {
    ...typography.body,
    color: colors.neutral500,
    textAlign: 'center',
    paddingHorizontal: spacing.xxl,
  },
});
