import React from 'react';
import {View, FlatList, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useSavedStore} from '../stores/useSavedStore';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/types';

export default function SavedScreen() {
  const {t} = useTranslation();
  const savedRoutes = useSavedStore((s) => s.savedRoutes);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.container}>
      <FlatList
        data={savedRoutes}
        keyExtractor={(item) => item.id}
        renderItem={({item}) => (
          <TouchableOpacity
            style={styles.routeItem}
            onPress={() =>
              navigation.navigate('RouteDetail', {routeId: item.id})
            }>
            <View style={styles.routeNumber}>
              <Text style={styles.routeNumberText}>{item.id}</Text>
            </View>
            <View style={styles.routeInfo}>
              <Text style={styles.routeName}>{item.name_en}</Text>
              {item.name_si && (
                <Text style={styles.routeNameLocal}>{item.name_si}</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>{t('saved.empty')}</Text>
            <Text style={styles.emptyHint}>{t('saved.add_hint')}</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  routeItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  routeNumber: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 12,
    minWidth: 50,
    alignItems: 'center',
  },
  routeNumberText: {color: '#fff', fontSize: 18, fontWeight: '700'},
  routeInfo: {flex: 1},
  routeName: {fontSize: 16, fontWeight: '600', color: '#333'},
  routeNameLocal: {fontSize: 14, color: '#666', marginTop: 2},
  emptyContainer: {padding: 40, alignItems: 'center'},
  emptyTitle: {fontSize: 18, color: '#999', fontWeight: '600'},
  emptyHint: {fontSize: 14, color: '#bbb', marginTop: 8, textAlign: 'center'},
});
