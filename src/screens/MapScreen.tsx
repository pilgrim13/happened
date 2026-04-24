import { LinearGradient } from 'expo-linear-gradient';
import { LocateFixed, Lock, MapPin, Navigation } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { placeBubbles } from '../data/happened';
import { colors, fonts, gradients, radius } from '../theme/tokens';

export function MapScreen() {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient colors={['#05070D', '#09131A', '#071015']} style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 18 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>Nearby places</Text>
            <Text style={styles.title}>Seoul memory field</Text>
          </View>
          <View style={styles.locationButton}>
            <LocateFixed color={colors.ink} size={20} strokeWidth={2.8} />
          </View>
        </View>

        <View style={styles.mapStage}>
          <LinearGradient colors={['rgba(57, 217, 242, 0.18)', 'rgba(199, 249, 91, 0.1)', 'rgba(255, 111, 97, 0.12)']} style={styles.mapWash} />
          <View style={styles.gridLineA} />
          <View style={styles.gridLineB} />
          <View style={styles.routeLine} />
          <View style={styles.userMarker}>
            <Navigation color={colors.ink} size={16} fill={colors.ink} />
          </View>
          {placeBubbles.map((place) => (
            <View
              key={place.id}
              style={[
                styles.placeBubble,
                {
                  left: `${place.x}%`,
                  top: `${place.y}%`,
                  transform: [{ translateX: -42 }, { translateY: -25 }],
                  opacity: place.intensity,
                },
              ]}
            >
              <LinearGradient colors={place.unlocked ? gradients.unlocked : gradients.locked} style={styles.bubbleGlow}>
                <View style={styles.bubbleInner}>
                  {place.unlocked ? <MapPin color={colors.ink} size={14} strokeWidth={2.8} /> : <Lock color={colors.ink} size={14} strokeWidth={2.8} />}
                  <Text style={styles.bubbleName}>{place.name}</Text>
                </View>
              </LinearGradient>
            </View>
          ))}
        </View>

        <View style={styles.legendRow}>
          {gradients.heat.map((color, index) => (
            <View key={color} style={[styles.heatSegment, { backgroundColor: color, opacity: 0.45 + index * 0.14 }]} />
          ))}
        </View>

        <View style={styles.placeList}>
          {placeBubbles.map((place) => (
            <View key={place.id} style={styles.placeRow}>
              <View style={[styles.placeDot, { backgroundColor: place.unlocked ? colors.lime : colors.coral }]} />
              <View style={styles.placeCopy}>
                <Text style={styles.placeName}>{place.name}</Text>
                <Text style={styles.placeSubtitle}>{place.subtitle}</Text>
              </View>
              <Text style={styles.placeState}>{place.unlocked ? 'Open' : 'Locked'}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </LinearGradient>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
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
    fontSize: 30,
    fontWeight: '900',
    marginTop: 3,
  },
  locationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lime,
  },
  mapStage: {
    height: 510,
    borderRadius: radius.panel,
    borderColor: colors.line,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#071017',
  },
  mapWash: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLineA: {
    position: 'absolute',
    left: -30,
    right: -30,
    top: 180,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    transform: [{ rotate: '-18deg' }],
  },
  gridLineB: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    left: 170,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    transform: [{ rotate: '12deg' }],
  },
  routeLine: {
    position: 'absolute',
    left: 40,
    right: 60,
    bottom: 140,
    height: 3,
    borderRadius: 3,
    backgroundColor: 'rgba(57, 217, 242, 0.5)',
    transform: [{ rotate: '-9deg' }],
  },
  userMarker: {
    position: 'absolute',
    left: '48%',
    top: '48%',
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cyan,
    borderColor: colors.text,
    borderWidth: 2,
  },
  placeBubble: {
    position: 'absolute',
    width: 84,
  },
  bubbleGlow: {
    borderRadius: radius.pill,
    padding: 1,
  },
  bubbleInner: {
    minHeight: 36,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 9,
  },
  bubbleName: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '900',
  },
  legendRow: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: 14,
    marginBottom: 18,
  },
  heatSegment: {
    flex: 1,
  },
  placeList: {
    gap: 9,
  },
  placeRow: {
    minHeight: 64,
    borderRadius: radius.panel,
    borderColor: colors.line,
    borderWidth: 1,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panel,
  },
  placeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  placeCopy: {
    flex: 1,
  },
  placeName: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '900',
  },
  placeSubtitle: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  placeState: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
  },
});
