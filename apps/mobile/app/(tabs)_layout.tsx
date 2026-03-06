import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, View } from "react-native";

function tabIcon(
  iconName: keyof typeof Ionicons.glyphMap,
  color: string,
  size: number,
  focused: boolean,
) {
  if (Platform.OS === "android") {
    return (
      <View
        style={{
          width: 56,
          height: 32,
          borderRadius: 16,
          backgroundColor: focused ? "rgba(27,122,61,0.15)" : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={iconName} size={size} color={color} />
      </View>
    );
  }
  return <Ionicons name={iconName} size={size} color={color} />;
}

export default function TabsLayout() {
  const renderHomeIcon = ({
    color,
    size,
    focused,
  }: {
    color: string;
    size: number;
    focused: boolean;
  }) => tabIcon("home", color, size, focused);

  const renderEntriesIcon = ({
    color,
    size,
    focused,
  }: {
    color: string;
    size: number;
    focused: boolean;
  }) => tabIcon("list", color, size, focused);

  const renderInsightsIcon = ({
    color,
    size,
    focused,
  }: {
    color: string;
    size: number;
    focused: boolean;
  }) => tabIcon("stats-chart", color, size, focused);

  const renderProfileIcon = ({
    color,
    size,
    focused,
  }: {
    color: string;
    size: number;
    focused: boolean;
  }) => tabIcon("person-circle", color, size, focused);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#008751",
        tabBarInactiveTintColor: "#8FA893",
        tabBarStyle: {
          borderTopColor: "#E8ECE9",
          height: Platform.OS === "ios" ? 76 : 72,
          paddingBottom: Platform.OS === "ios" ? 14 : 10,
          paddingTop: 8,
          backgroundColor: Platform.OS === "ios" ? "rgba(255,255,255,0.95)" : "#FFFFFF",
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: Platform.OS === "ios" ? "500" : "400",
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: renderHomeIcon,
        }}
      />
      <Tabs.Screen
        name="entries"
        options={{
          title: "Entries",
          tabBarIcon: renderEntriesIcon,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Capture",
          tabBarIcon: () => (
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: "#1B7A3D",
                alignItems: "center",
                justifyContent: "center",
                marginTop: -16,
              }}
            >
              <Ionicons name="add" size={26} color="#fff" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="mileage"
        options={{
          href: null,
          title: "Mileage",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="navigate" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="work-orders"
        options={{
          title: "Work Orders",
          tabBarIcon: ({ color, size, focused }) =>
            tabIcon("construct", color, size, focused),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: "Insights",
          tabBarIcon: renderInsightsIcon,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Profile",
          tabBarIcon: renderProfileIcon,
        }}
      />
    </Tabs>
  );
}
