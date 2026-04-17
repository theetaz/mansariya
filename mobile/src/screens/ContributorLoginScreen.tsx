import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {colors, spacing, radii} from '../constants/theme';
import {useTheme} from '../hooks/useTheme';
import {useContributorStore} from '../stores/useContributorStore';
import {contributorLogin, fetchContributorProfile} from '../services/contributorApi';
import {saveTokens} from '../services/contributorAuth';

export default function ContributorLoginScreen() {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {colors: tc} = useTheme();

  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);

    if (!displayName.trim() || !password) {
      setError(t('contributor.error_login_failed'));
      return;
    }

    setLoading(true);
    try {
      const tokens = await contributorLogin(displayName.trim(), password);
      await saveTokens(tokens.access_token, tokens.refresh_token, tokens.expires_at);

      const store = useContributorStore.getState();
      store.setContributor(tokens.contributor);
      store.setAuthenticated(true);

      // Fetch full profile with stats
      try {
        const {contributor, stats} = await fetchContributorProfile();
        store.setContributor(contributor);
        store.setStats(stats);
      } catch {
        // Non-critical — we already have the contributor from login
      }

      navigation.goBack();
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === 'not_claimed') {
        setError(t('contributor.error_not_claimed', {defaultValue: 'Account not yet claimed'}));
      } else {
        setError(t('contributor.error_login_failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, {backgroundColor: tc.background}]}
      contentContainerStyle={{paddingBottom: insets.bottom + 40}}
      keyboardShouldPersistTaps="handled">
      <Text style={[styles.label, {color: tc.text}]}>
        {t('contributor.display_name')}
      </Text>
      <TextInput
        style={[styles.input, {backgroundColor: tc.inputBg, color: tc.text}]}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder={t('contributor.display_name')}
        placeholderTextColor={tc.textTertiary}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={[styles.label, {color: tc.text}]}>
        {t('contributor.password')}
      </Text>
      <TextInput
        style={[styles.input, {backgroundColor: tc.inputBg, color: tc.text}]}
        value={password}
        onChangeText={setPassword}
        placeholder={t('contributor.password')}
        placeholderTextColor={tc.textTertiary}
        secureTextEntry
      />

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={loading}
        activeOpacity={0.7}>
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>{t('contributor.login_button')}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xxl},
  label: {fontSize: 14, fontWeight: '500', marginBottom: spacing.xs, marginTop: spacing.lg},
  input: {
    height: 48,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
  },
  errorText: {
    color: colors.red,
    fontSize: 14,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.xxl,
    backgroundColor: colors.green,
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  buttonDisabled: {opacity: 0.6},
  buttonText: {color: '#FFFFFF', fontSize: 16, fontWeight: '600'},
});
