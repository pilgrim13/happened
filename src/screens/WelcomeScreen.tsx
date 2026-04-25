import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Heart, Lock, MapPin, MessageCircle } from 'lucide-react-native';
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { seedMediaUrls } from '../data/happened';
import { useI18n } from '../i18n';
import { colors, fonts, radius } from '../theme/tokens';

type Props = {
  onCreateAccount: () => void;
  onLogIn: () => void;
};

export function WelcomeScreen({ onCreateAccount, onLogIn }: Props) {
  const insets = useSafeAreaInsets();
  const { t, toggleLanguage } = useI18n();
  const { width } = useWindowDimensions();
  const compactLayout = width < 720;
  const frameWidth = compactLayout ? Math.max(280, Math.min(width - 32, 358)) : 390;

  return (
    <LinearGradient colors={[colors.setlogBg, '#FFF2F5', '#F8F7FF']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          compactLayout ? styles.contentMobile : styles.contentCentered,
          { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom + 24, 28) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { width: frameWidth }]}>
          <Pressable style={styles.languageButton} onPress={toggleLanguage}>
            <Text style={styles.languageText}>{t('language.switchTo')}</Text>
          </Pressable>
          <View style={styles.logoMark}>
            <MapPin color={colors.setlogInk} size={20} strokeWidth={3} />
          </View>
          <Text style={styles.brand}>Happened</Text>
          <Text style={styles.subtitle}>{t('welcome.subtitle')}</Text>
        </View>

        <View style={[styles.previewStack, { width: frameWidth }]}>
          <View style={styles.postCard}>
            <View style={styles.postHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>M</Text>
              </View>
              <View style={styles.postHeaderCopy}>
                <Text style={styles.name}>Mina</Text>
                <Text style={styles.meta}>{t('welcome.meta')}</Text>
              </View>
              <View style={styles.openBadge}>
                <Text style={styles.openBadgeText}>{t('common.open')}</Text>
              </View>
            </View>

            <View style={styles.photoPreview}>
              <Image source={{ uri: seedMediaUrls['seolleung-cafe-2023'] }} resizeMode="cover" style={styles.photoImage} />
              <LinearGradient colors={['rgba(0,0,0,0.06)', 'rgba(0,0,0,0.58)']} style={StyleSheet.absoluteFill} />
              <View style={styles.lockPill}>
                <Lock color={colors.setlogPaper} size={14} strokeWidth={2.6} />
                <Text style={styles.lockPillText}>{t('welcome.placeBased')}</Text>
              </View>
              <Text style={styles.photoTitle}>{t('welcome.previewTitle')}</Text>
            </View>

            <View style={styles.actionRow}>
              <View style={styles.actionItem}>
                <Heart color={colors.setlogInk} size={19} />
                <Text style={styles.actionText}>128</Text>
              </View>
              <View style={styles.actionItem}>
                <MessageCircle color={colors.setlogInk} size={19} />
                <Text style={styles.actionText}>24</Text>
              </View>
              <View style={styles.actionItem}>
                <Camera color={colors.setlogInk} size={19} />
                <Text style={styles.actionText}>{t('welcome.checkIn')}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.actions, { width: frameWidth }]}>
          <Pressable style={styles.primaryButton} onPress={onCreateAccount}>
            <Text style={styles.primaryText}>{t('welcome.create')}</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={onLogIn}>
            <Text style={styles.secondaryText}>{t('welcome.login')}</Text>
          </Pressable>
        </View>

        <View style={[styles.benefits, { width: frameWidth }]}>
          <Benefit title={t('welcome.benefit1Title')} text={t('welcome.benefit1Text')} />
          <Benefit title={t('welcome.benefit2Title')} text={t('welcome.benefit2Text')} />
          <Benefit title={t('welcome.benefit3Title')} text={t('welcome.benefit3Text')} />
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

function Benefit({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.benefit}>
      <View style={styles.benefitDot} />
      <View style={styles.benefitCopy}>
        <Text style={styles.benefitTitle}>{title}</Text>
        <Text style={styles.benefitText}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  contentMobile: {
    alignItems: 'flex-start',
    paddingHorizontal: 16,
  },
  contentCentered: {
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  header: {
    width: '92%',
    maxWidth: 390,
    alignItems: 'center',
  },
  languageButton: {
    alignSelf: 'flex-end',
    minHeight: 32,
    borderRadius: radius.pill,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 11,
    marginBottom: 8,
    backgroundColor: colors.setlogPaper,
  },
  languageText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
  },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.setlogYellow,
    marginBottom: 10,
  },
  brand: {
    color: colors.setlogInk,
    fontFamily: fonts.display,
    fontSize: 40,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
    width: '100%',
    maxWidth: 305,
  },
  previewStack: {
    width: '92%',
    maxWidth: 390,
    marginTop: 15,
  },
  postCard: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.setlogPaper,
    borderColor: colors.setlogLine,
    borderWidth: 1,
  },
  postHeader: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.setlogBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: colors.setlogInk,
    fontFamily: fonts.display,
    fontSize: 17,
    fontWeight: '900',
  },
  postHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '900',
  },
  meta: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  openBadge: {
    minHeight: 28,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(135, 240, 182, 0.24)',
  },
  openBadgeText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
  },
  photoPreview: {
    height: 204,
    overflow: 'hidden',
    justifyContent: 'space-between',
    padding: 14,
  },
  photoImage: {
    ...StyleSheet.absoluteFillObject,
  },
  lockPill: {
    alignSelf: 'flex-start',
    minHeight: 34,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(7,8,11,0.62)',
  },
  lockPillText: {
    color: colors.setlogPaper,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
  },
  photoTitle: {
    color: colors.setlogPaper,
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
    maxWidth: 285,
  },
  actionRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingHorizontal: 13,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '800',
  },
  benefits: {
    width: '92%',
    maxWidth: 390,
    gap: 10,
    marginTop: 14,
  },
  benefit: {
    minHeight: 62,
    borderRadius: 18,
    backgroundColor: colors.setlogPaper,
    borderColor: colors.setlogLine,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  benefitDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.setlogMint,
    marginRight: 11,
  },
  benefitCopy: {
    flex: 1,
  },
  benefitTitle: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '900',
  },
  benefitText: {
    color: colors.setlogMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 2,
  },
  actions: {
    width: '92%',
    maxWidth: 390,
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  primaryButton: {
    flex: 1.35,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.setlogInk,
  },
  primaryText: {
    color: colors.setlogPaper,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButton: {
    flex: 0.85,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.setlogLine,
    borderWidth: 1,
    backgroundColor: colors.setlogPaper,
  },
  secondaryText: {
    color: colors.setlogInk,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '900',
  },
});
