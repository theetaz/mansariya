import React, {useState} from 'react';
import {
  View,
  TextInput,
  FlatList,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useRouteSearch} from '../hooks/useRouteSearch';
import {Route} from '../services/api';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/types';

export default function SearchScreen() {
  const {t} = useTranslation();
  const {results, loading, search} = useRouteSearch();
  const [query, setQuery] = useState('');
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleSearch = (text: string) => {
    setQuery(text);
    search(text);
  };

  const handleRoutePress = (route: Route) => {
    navigation.navigate('RouteDetail', {routeId: route.id});
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          placeholder={t('search.placeholder')}
          value={query}
          onChangeText={handleSearch}
          autoFocus
        />
      </View>

      {loading && <ActivityIndicator style={styles.loader} />}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({item}) => (
          <TouchableOpacity
            style={styles.resultItem}
            onPress={() => handleRoutePress(item)}>
            <View style={styles.routeNumber}>
              <Text style={styles.routeNumberText}>{item.id}</Text>
            </View>
            <View style={styles.routeInfo}>
              <Text style={styles.routeName}>{item.name_en}</Text>
              {item.name_si && (
                <Text style={styles.routeNameLocal}>{item.name_si}</Text>
              )}
              {item.operator && (
                <Text style={styles.operator}>{item.operator}</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          query.length > 0 && !loading ? (
            <Text style={styles.empty}>{t('search.no_results')}</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  searchBar: {padding: 16, backgroundColor: '#f5f5f5'},
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  loader: {padding: 20},
  resultItem: {
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
  operator: {fontSize: 12, color: '#999', marginTop: 2},
  empty: {textAlign: 'center', padding: 40, color: '#999', fontSize: 16},
});
