import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { getUserId } from "@/lib/auth/user-id";
import {
  addWorkOrderPhoto,
  createWorkOrder,
  listWorkOrderPhotos,
  listWorkOrders,
  updateWorkOrderStatus,
} from "@/lib/db/work-order-repository";

export default function WorkOrdersScreen() {
  const [technicianId, setTechnicianId] = useState<string | null>(null);
  const [qrPayload, setQrPayload] = useState("");
  const [title, setTitle] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    getUserId().then(setTechnicianId).catch(() => setTechnicianId("unknown"));
  }, []);

  const rows = useMemo(() => {
    return listWorkOrders(technicianId ?? "unknown");
  }, [refreshKey, technicianId]);

  const onCreate = async () => {
    if (!title.trim()) {
      Alert.alert("Missing title", "Enter a title for the work order.");
      return;
    }
    const technicianId = await getUserId();
    const tenantId = technicianId;
    createWorkOrder({
      tenantId,
      technicianId,
      title: title.trim(),
      qrPayload: qrPayload.trim() || null,
      notes: "Created offline from technician mobile UI",
    });
    setTitle("");
    setQrPayload("");
    setRefreshKey((prev) => prev + 1);
  };

  const onAttachPhoto = async (workOrderId: string) => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    addWorkOrderPhoto(workOrderId, result.assets[0].uri);
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Technician Work Orders</Text>
      <Text style={styles.subheading}>
        Offline work orders with QR payload lookup, photos, and signatures.
      </Text>

      <View style={styles.card}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Work order title"
          placeholderTextColor="#8FA893"
          style={styles.input}
        />
        <TextInput
          value={qrPayload}
          onChangeText={setQrPayload}
          placeholder="QR payload (paste or scan value)"
          placeholderTextColor="#8FA893"
          style={styles.input}
        />
        <Pressable style={styles.primaryButton} onPress={onCreate}>
          <Text style={styles.primaryText}>Create offline work order</Text>
        </Pressable>
      </View>

      <View style={styles.list}>
        {rows.length === 0 ? (
          <Text style={styles.empty}>No work orders yet.</Text>
        ) : (
          rows.map((row) => {
            const photos = listWorkOrderPhotos(row.id);
            return (
              <View key={row.id} style={styles.rowCard}>
                <Text style={styles.rowTitle}>{row.title}</Text>
                <Text style={styles.meta}>
                  {row.status} • {row.priority} • photos {photos.length}
                </Text>
                <View style={styles.rowActions}>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => onAttachPhoto(row.id)}
                  >
                    <Text style={styles.secondaryText}>Photo Upload</Text>
                  </Pressable>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => {
                      updateWorkOrderStatus(row.id, "completed", "signed-on-device");
                      setRefreshKey((prev) => prev + 1);
                    }}
                  >
                    <Text style={styles.secondaryText}>Digital Signature</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D1B0E" },
  content: { padding: 18, gap: 14, paddingBottom: 120 },
  heading: { color: "#fff", fontSize: 22, fontWeight: "700" },
  subheading: { color: "#8FA893", fontSize: 13 },
  card: {
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 12,
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: "#fff",
  },
  primaryButton: {
    backgroundColor: "#22c55e",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  primaryText: { color: "#052e16", fontSize: 14, fontWeight: "700" },
  list: { gap: 10 },
  rowCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    padding: 12,
    gap: 8,
  },
  rowTitle: { color: "#fff", fontSize: 15, fontWeight: "600" },
  meta: { color: "#8FA893", fontSize: 12 },
  rowActions: { flexDirection: "row", gap: 8 },
  secondaryButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4ADE80",
    paddingVertical: 8,
    alignItems: "center",
  },
  secondaryText: { color: "#4ADE80", fontSize: 12, fontWeight: "600" },
  empty: { color: "#8FA893", fontSize: 13 },
});
