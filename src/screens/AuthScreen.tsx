import { LinearGradient } from 'expo-linear-gradient';
import { LogIn, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { translateServerMessage, useI18n } from '../i18n';
import { loginAccount, registerAccount } from '../services/happenedApi';
import { colors, fonts, radius } from '../theme/tokens';
import type { AuthSession } from '../types/happened';

type Props = {
  initialMode?: 'register' | 'login';
  onComplete: (session: AuthSession) => void;
  onBack: () => void;
};

const DEFAULT_TEST_EMAIL = 'test@happened.dev';
const DEFAULT_TEST_PASSWORD = 'happened-test-1';
const LAST_EMAIL_KEY = 'happened-last-email';

function createDefaultAccountSeed() {
  const suffix = Date.now().toString().slice(-5);

  return {
    email: `friend${suffix}@happened.test`,
    displayName: 'Friend',
    handle: `friend${suffix}`,
    password: DEFAULT_TEST_PASSWORD,
  };
}

function readLastEmail() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(LAST_EMAIL_KEY);
}

function rememberEmail(email: string) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(LAST_EMAIL_KEY, email);
}

function getDefaultLoginInput() {
  const lastEmail = readLastEmail();
  const loginEmail = lastEmail ?? DEFAULT_TEST_EMAIL;

  return {
    email: loginEmail,
    password: loginEmail === DEFAULT_TEST_EMAIL ? DEFAULT_TEST_PASSWORD : '',
  };
}

export function AuthScreen({ initialMode = 'register', onComplete, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { language, t } = useI18n();
  const defaultAccount = createDefaultAccountSeed();
  const defaultLogin = getDefaultLoginInput();
  const [mode, setMode] = useState<'register' | 'login'>(initialMode);
  const [email, setEmail] = useState(() => (initialMode === 'login' ? defaultLogin.email : defaultAccount.email));
  const [displayName, setDisplayName] = useState(defaultAccount.displayName);
  const [handle, setHandle] = useState(defaultAccount.handle);
  const [password, setPassword] = useState(initialMode === 'login' ? defaultLogin.password : defaultAccount.password);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (
    mode: 'register' | 'login',
    input = {
      email,
      displayName,
      handle,
      password,
    },
  ) => {
    setBusy(true);
    setError(null);

    try {
      const session =
        mode === 'register'
          ? await registerAccount(input)
          : await loginAccount({ email: input.email, password: input.password });

      rememberEmail(input.email);
      onComplete(session);
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : t('auth.failed');
      if (message.includes('incorrect')) {
        setError(t('auth.incorrect'));
      } else if (message.includes('already')) {
        setError(t('auth.already'));
      } else {
        setError(translateServerMessage(message, language));
      }
    } finally {
      setBusy(false);
    }
  };

  const createQuickAccount = () => {
    const suffix = Date.now().toString().slice(-6);
    const input = {
      email: `friend${suffix}@happened.test`,
      displayName: `Friend ${suffix.slice(-3)}`,
      handle: `friend${suffix}`,
      password: DEFAULT_TEST_PASSWORD,
    };

    setEmail(input.email);
    setDisplayName(input.displayName);
    setHandle(input.handle);
    setPassword(input.password);
    void submit('register', input);
  };

  return (
    <LinearGradient colors={[colors.setlogBg, '#FFF2F5', '#F7F4FF']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>{t('common.back')}</Text>
          </Pressable>
          <Text style={styles.kicker}>{mode === 'register' ? t('auth.create') : t('auth.login')}</Text>
          <Text style={styles.title}>{mode === 'register' ? t('auth.registerTitle') : t('auth.loginTitle')}</Text>
          <Text style={styles.copy}>{mode === 'register' ? t('auth.registerCopy') : t('auth.loginCopy')}</Text>
        </View>

        <View style={styles.form}>
          <Field label={t('auth.email')} value={email} onChangeText={setEmail} />
          {mode === 'register' ? <Field label={t('auth.name')} value={displayName} onChangeText={setDisplayName} /> : null}
          {mode === 'register' ? <Field label={t('auth.nickname')} value={handle} onChangeText={setHandle} /> : null}
          <Field label={t('auth.password')} value={password} onChangeText={setPassword} secure />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        <Pressable style={styles.primaryButton} onPress={() => submit(mode)} disabled={busy}>
          <Text style={styles.primaryText}>{busy ? t('auth.working') : mode === 'register' ? t('auth.create') : t('auth.login')}</Text>
        </Pressable>

        <View style={styles.secondaryActions}>
          {mode === 'register' ? <Pressable style={styles.secondaryAction} onPress={createQuickAccount} disabled={busy}>
            <Sparkles color={colors.setlogInk} size={18} />
            <Text style={styles.secondaryActionText}>{t('auth.quick')}</Text>
          </Pressable> : null}
          <Pressable
            style={styles.secondaryActionDark}
            onPress={() => {
              const nextMode = mode === 'register' ? 'login' : 'register';
              setMode(nextMode);

              if (nextMode === 'login') {
                const loginInput = getDefaultLoginInput();
                setEmail(loginInput.email);
                setPassword(loginInput.password);
              } else {
                const nextAccount = createDefaultAccountSeed();
                setEmail(nextAccount.email);
                setDisplayName(nextAccount.displayName);
                setHandle(nextAccount.handle);
                setPassword(nextAccount.password);
              }
            }}
            disabled={busy}
          >
            <LogIn color={colors.setlogInk} size={18} />
            <Text style={styles.secondaryActionTextDark}>{mode === 'register' ? t('auth.loginExisting') : t('auth.createNew')}</Text>
          </Pressable>
        </View>

      </ScrollView>
    </LinearGradient>
  );
}

function Field({ label, value, secure = false, onChangeText }: { label: string; value: string; secure?: boolean; onChangeText: (value: string) => void }) {
  const { t } = useI18n();

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        editable
        secureTextEntry={secure}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        placeholderTextColor={colors.setlogFaint}
      />
      <Text style={styles.validText}>{t('common.required')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginBottom: 18,
  },
  backText: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '900',
  },
  kicker: {
    color: colors.setlogLavender,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.setlogInk,
    fontFamily: fonts.display,
    fontSize: 34,
    fontWeight: '900',
    marginTop: 6,
  },
  copy: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  form: {
    gap: 10,
    marginTop: 28,
  },
  field: {
    borderRadius: 18,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    padding: 12,
    backgroundColor: colors.setlogPaper,
  },
  fieldLabel: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  input: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 17,
    fontWeight: '900',
    paddingVertical: 7,
  },
  validText: {
    color: colors.setlogMint,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '900',
  },
  errorText: {
    color: colors.coral,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  secondaryAction: {
    flex: 1,
    height: 50,
    borderRadius: 18,
    backgroundColor: colors.setlogPaper,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  secondaryActionDark: {
    flex: 1,
    height: 50,
    borderRadius: 18,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    backgroundColor: colors.setlogPaper,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  secondaryActionText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
  },
  secondaryActionTextDark: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
  },
  primaryButton: {
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.setlogMint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '900',
  },
});
