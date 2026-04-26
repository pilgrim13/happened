import { AlertCircle, Inbox } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text } from 'react-native';

import { colors, fonts, motion, typography } from '../theme/tokens';

type Props = {
  variant: 'loading' | 'empty' | 'error';
  title?: string;
  message?: string;
  action?: { label: string; onPress: () => void };
};

export function ScreenState({ variant, title, message, action }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: motion.duration.base, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: motion.duration.base, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  const defaultTitle =
    variant === 'loading' ? '불러오는 중...'
    : variant === 'empty' ? '아직 없어요'
    : '오류가 발생했어요';

  const defaultMessage =
    variant === 'error' ? '잠시 후 다시 시도해 주세요.' : undefined;

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ translateY }] }]}>
      {variant === 'loading' ? (
        <ActivityIndicator size="large" color={colors.setlogMuted} style={styles.indicator} />
      ) : variant === 'error' ? (
        <Animated.View style={styles.iconWrap}>
          <AlertCircle color={colors.coral} size={36} strokeWidth={2} />
        </Animated.View>
      ) : (
        <Animated.View style={styles.iconWrap}>
          <Inbox color={colors.setlogMuted} size={36} strokeWidth={1.8} />
        </Animated.View>
      )}
      <Text style={styles.title}>{title ?? defaultTitle}</Text>
      {(message ?? defaultMessage) ? (
        <Text style={styles.message}>{message ?? defaultMessage}</Text>
      ) : null}
      {action ? (
        <Pressable
          style={[styles.button, variant === 'error' && styles.buttonError]}
          onPress={action.onPress}
        >
          <Text style={styles.buttonText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 200,
    borderRadius: 24,
    backgroundColor: colors.setlogPaper,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 8,
  },
  indicator: {
    marginBottom: 4,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(23, 18, 15, 0.05)',
    marginBottom: 4,
  },
  title: {
    color: colors.setlogInk,
    fontFamily: fonts.display,
    ...typography.h3,
    textAlign: 'center',
  },
  message: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    ...typography.bodySm,
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    minHeight: 40,
    borderRadius: 999,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.setlogMint,
  },
  buttonError: {
    backgroundColor: colors.coral,
  },
  buttonText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    ...typography.label,
    fontWeight: '900' as const,
  },
});
