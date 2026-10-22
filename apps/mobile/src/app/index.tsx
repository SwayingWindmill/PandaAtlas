import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, radius } from "@/lib/theme";

export default function HomeScreen() {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.eyebrow}>熊猫游戏</Text>
      <Text style={styles.title}>轻松玩一会儿，也认识一只新熊猫。</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>每日一猫</Text>
        <Text style={styles.cardBody}>每天所有人猜同一只熊猫，猜错一次多揭开一条线索。</Text>
        <Link href="/daily" asChild>
          <Pressable style={styles.button} accessibilityRole="button">
            <Text style={styles.buttonText}>猜今天的熊猫</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, gap: 16 },
  eyebrow: { color: colors.accent, fontWeight: "600" },
  title: { color: colors.ink, fontSize: 28, fontWeight: "700", lineHeight: 36 },
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radius.card, padding: 20, gap: 10 },
  cardTitle: { color: colors.ink, fontSize: 22, fontWeight: "700" },
  cardBody: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  button: { alignSelf: "flex-start", backgroundColor: colors.accent, borderRadius: radius.control, paddingHorizontal: 18, paddingVertical: 12, marginTop: 6 },
  buttonText: { color: colors.onAccent, fontWeight: "700", fontSize: 16 },
});
