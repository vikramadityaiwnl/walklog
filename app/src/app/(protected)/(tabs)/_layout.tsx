import { Tabs } from "expo-router";
import {
  ClipboardDocumentListIcon,
  Square3Stack3DIcon,
  UserCircleIcon,
} from "react-native-heroicons/outline";
import { colors } from "../../../theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontFamily: "DMSans_600SemiBold" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Walkthroughs",
          tabBarIcon: ({ color, size }) => (
            <ClipboardDocumentListIcon color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: "Projects",
          tabBarIcon: ({ color, size }) => (
            <Square3Stack3DIcon color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <UserCircleIcon color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
