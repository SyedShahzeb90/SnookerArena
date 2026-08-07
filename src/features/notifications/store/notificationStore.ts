import { create } from "zustand";
import { persist } from "zustand/middleware";

interface NotificationStore {
  readNotificationIds: string[];
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: (ids: string[]) => void;
}

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set) => ({
      readNotificationIds: [],
      markNotificationRead: (id) =>
        set((state) => ({
          readNotificationIds: state.readNotificationIds.includes(id)
            ? state.readNotificationIds
            : [...state.readNotificationIds, id],
        })),
      markAllNotificationsRead: (ids) =>
        set((state) => ({
          readNotificationIds: Array.from(
            new Set([...state.readNotificationIds, ...ids])
          ),
        })),
    }),
    { name: "snooker-arena-notifications" }
  )
);
