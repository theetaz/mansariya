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
import {claimContributor} from '../services/contributorApi';

export default function ContributorClaimScreen() {
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {colors: tc} = useTheme();

  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClaim = async () => {
    setError(null);

    if (displayName.trim().length < 3) {
      setError(t('contributor.error_name_too_short'));
      return;
    }
    if (password.length < 8) {
      setError(t('contributor.error_password_too_short'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('contributor.error_password_mismatch'));
      return;
    }

    setLoading(true);
    try {
      const {contributor} = await claimContributor(displayName.trim(), password);
      useContributorStore.getState().setContributor(contributor);
      navigation.goBack();
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === 'display_name_taken') {
        setError(t('contributor.error_name_taken'));
      } else if (code === 'already_claimed') {
        setError(t('contributor.error_already_claimed', {defaultValue: 'Profile already claimed'}));
      } else {
        setError(t('contributor.error_claim_failed'));
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
      <Text style={[styles.description, {color: tc.textSecondary}]}>
        {t('contributor.claim_description')}
      </Text>

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

      <Text style={[styles.label, {color: tc.text}]}>
        {t('contributor.confirm_password')}
      </Text>
      <TextInput
        style={[styles.input, {backgroundColor: tc.inputBg, color: tc.text}]}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder={t('contributor.confirm_password')}
        placeholderTextColor={tc.textTertiary}
        secureTextEntry
      />

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleClaim}
        disabled={loading}
        activeOpacity={0.7}>
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>{t('contributor.claim_button')}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xxl},
  description: {fontSize: 15, lineHeight: 22, marginBottom: spacing.xxl},
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
