import { LinearGradient } from 'expo-linear-gradient';
import { Ban, Bell, Shield, Trash2, UserPlus } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, radius } from '../theme/tokens';

const safetyRows = [
  { id: 'block', label: 'Blocked accounts', value: '0', Icon: Ban },
  { id: 'report', label: 'Reports and hidden posts', value: 'Ready', Icon: Shield },
  { id: 'notify', label: 'Revisit recall alerts', value: 'On', Icon: Bell },
  { id: 'delete', label: 'Account deletion', value: 'Available', Icon: Trash2 },
];

export function ProfileScreen() {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient colors={['#05070D', '#0C1116', '#091916']} style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 18 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>J</Text>
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.name}>Junn</Text>
            <Text style={styles.handle}>@junn</Text>
          </View>
          <View style={styles.addButton}>
            <UserPlus color={colors.ink} size={19} strokeWidth={2.8} />
          </View>
        </View>

        <View style={styles.stats}>
          <Stat label="Places" value="18" />
          <Stat label="Memories" value="46" />
          <Stat label="Followers" value="128" />
        </View>

        <View style={styles.defaultCard}>
          <Text style={styles.sectionLabel}>Default visibility</Text>
          <Text style={styles.defaultTitle}>Followers only</Text>
          <Text style={styles.defaultText}>Public posting stays available per memory, but private sharing is the baseline.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Safety</Text>
          {safetyRows.map(({ id, label, value, Icon }) => (
            <View key={id} style={styles.safetyRow}>
              <View style={styles.safetyIcon}>
                <Icon color={colors.text} size={18} strokeWidth={2.4} />
              </View>
              <Text style={styles.safetyLabel}>{label}</Text>
              <Text style={styles.safetyValue}>{value}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 130,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lime,
    marginRight: 13,
  },
  avatarText: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 30,
    fontWeight: '900',
  },
  profileCopy: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 31,
    fontWeight: '900',
  },
  handle: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cyan,
  },
  stats: {
    flexDirection: 'row',
    gap: 9,
    marginBottom: 14,
  },
  stat: {
    flex: 1,
    minHeight: 76,
    borderRadius: radius.panel,
    borderColor: colors.line,
    borderWidth: 1,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
  },
  defaultCard: {
    borderRadius: radius.panel,
    borderColor: 'rgba(57, 217, 242, 0.3)',
    borderWidth: 1,
    backgroundColor: 'rgba(57, 217, 242, 0.1)',
    padding: 15,
    marginBottom: 18,
  },
  sectionLabel: {
    color: colors.lime,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  defaultTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 6,
  },
  defaultText: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    marginTop: 5,
  },
  section: {
    gap: 9,
  },
  safetyRow: {
    minHeight: 58,
    borderRadius: radius.panel,
    borderColor: colors.line,
    borderWidth: 1,
    backgroundColor: colors.panel,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  safetyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 247, 242, 0.08)',
    marginRight: 10,
  },
  safetyLabel: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '900',
    flex: 1,
  },
  safetyValue: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
  },
});
