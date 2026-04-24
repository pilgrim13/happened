import { LinearGradient } from 'expo-linear-gradient';
import { Apple, Mail } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, radius } from '../theme/tokens';

type Props = {
  onComplete: () => void;
  onBack: () => void;
};

export function AuthScreen({ onComplete, onBack }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient colors={['#05070D', '#101018', '#091916']} style={styles.screen}>
      <View style={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>
        <View>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.kicker}>Create account</Text>
          <Text style={styles.title}>테스트 계정으로 시작</Text>
          <Text style={styles.copy}>실제 인증은 나중에 연결하고, 지금은 가입 플로우와 세션 진입을 테스트한다.</Text>
        </View>

        <View style={styles.form}>
          <Field label="Email" value="junn@example.com" />
          <Field label="Name" value="Junn" />
          <Field label="Nickname" value="junn" />
          <Field label="Password" value="••••••••" secure />
        </View>

        <View style={styles.socials}>
          <Pressable style={styles.socialButton} onPress={onComplete}>
            <Mail color={colors.ink} size={18} />
            <Text style={styles.socialText}>Continue with Google mock</Text>
          </Pressable>
          <Pressable style={styles.socialButtonDark} onPress={onComplete}>
            <Apple color={colors.text} size={18} />
            <Text style={styles.socialTextDark}>Continue with Apple mock</Text>
          </Pressable>
        </View>

        <Pressable style={styles.primaryButton} onPress={onComplete}>
          <Text style={styles.primaryText}>Create mock account</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

function Field({ label, value, secure = false }: { label: string; value: string; secure?: boolean }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        editable={false}
        secureTextEntry={secure}
        style={styles.input}
        value={value}
        placeholderTextColor={colors.faint}
      />
      <Text style={styles.validText}>Valid</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginBottom: 18,
  },
  backText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '900',
  },
  kicker: {
    color: colors.lime,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 34,
    fontWeight: '900',
    marginTop: 6,
  },
  copy: {
    color: colors.muted,
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
    borderRadius: radius.panel,
    borderColor: colors.line,
    borderWidth: 1,
    padding: 12,
    backgroundColor: colors.panel,
  },
  fieldLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  input: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 17,
    fontWeight: '900',
    paddingVertical: 7,
  },
  validText: {
    color: colors.lime,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '900',
  },
  socials: {
    gap: 10,
    marginTop: 'auto',
    marginBottom: 12,
  },
  socialButton: {
    height: 52,
    borderRadius: radius.panel,
    backgroundColor: colors.text,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  socialButtonDark: {
    height: 52,
    borderRadius: radius.panel,
    borderColor: colors.line,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 247, 242, 0.06)',
  },
  socialText: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '900',
  },
  socialTextDark: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '900',
  },
  primaryButton: {
    height: 56,
    borderRadius: radius.panel,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '900',
  },
});
