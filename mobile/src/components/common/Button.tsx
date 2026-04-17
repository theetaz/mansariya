import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
} from 'react-native';

import {palette, radii, typography} from '../../constants/theme';
import {useTheme} from '../../hooks/useTheme';

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

/**
 * Shared button primitive — refreshed for the redesign.
 *
 * primary   — filled emerald with drop shadow, white label (use for the
 *             single primary action on a screen).
 * secondary — card surface + emerald 1.5px border + emerald label.
 * danger    — filled coral for destructive actions ("Stop sharing").
 * text      — ghost action, text-only.
 *
 * Press feedback: 0.97 scale, 120ms — matches the handoff motion spec.
 */
export default function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const {surface} = useTheme();
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const isSecondary = variant === 'secondary';
  const isText = variant === 'text';

  const fill =
    isPrimary ? palette.emerald : isDanger ? palette.coral : 'transparent';
  const spinnerColor =
    isPrimary || isDanger ? '#FFFFFF' : palette.emerald;

  const labelColor = isPrimary || isDanger
    ? '#FFFFFF'
    : isSecondary
      ? palette.emerald
      : surface.textDim;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({pressed}) => [
        styles.base,
        {
          backgroundColor: isSecondary ? surface.card : fill,
          borderColor: isSecondary ? palette.emerald : 'transparent',
          borderWidth: isSecondary ? 1.5 : 0,
          height: isText ? 40 : 52,
          transform: [{scale: pressed ? 0.97 : 1}],
          opacity: disabled ? 0.5 : 1,
          shadowColor: isPrimary
            ? palette.emerald
            : isDanger
              ? palette.coral
              : 'transparent',
          shadowOffset: {width: 0, height: 12},
          shadowOpacity: isPrimary || isDanger ? 0.22 : 0,
          shadowRadius: 24,
          elevation: isPrimary || isDanger ? 6 : 0,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <Text
          style={[
            styles.label,
            {color: labelColor},
            isText && styles.textLabel,
          ]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  label: {
    ...typography.button,
    includeFontPadding: false,
    letterSpacing: 0.2,
  },
  textLabel: {
    fontWeight: '500',
  },
});
