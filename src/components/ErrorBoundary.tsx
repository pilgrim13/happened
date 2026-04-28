import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, fonts, radius, spacing } from '../theme/tokens';

interface State {
  hasError: boolean;
  error: Error | null;
  retryKey: number;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false, error: null, retryKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  render() {
    if (!this.state.hasError) {
      return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>;
    }
    return (
      <View style={styles.container}>
        <Text style={styles.title}>앗, 문제가 발생했어요</Text>
        {__DEV__ && this.state.error ? (
          <Text style={styles.detail}>{this.state.error.message}</Text>
        ) : null}
        <TouchableOpacity
          style={styles.button}
          onPress={() => this.setState((s) => ({ hasError: false, error: null, retryKey: s.retryKey + 1 }))}
        >
          <Text style={styles.buttonText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontFamily: fonts.display,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  detail: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: fonts.body,
    marginBottom: spacing.lg,
    textAlign: 'center',
    backgroundColor: colors.setlogBg,
    borderRadius: radius.panel,
    padding: spacing.md,
    overflow: 'hidden',
  },
  button: {
    backgroundColor: colors.setlogBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  buttonText: {
    color: colors.setlogInk,
    fontSize: 15,
    fontFamily: fonts.display,
  },
});
