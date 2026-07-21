import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AccessoryItem {
  id: string;
  name: string;
  price: number;
  category: "Tips" | "Sticks" | "Gloves" | "Chalk" | "Other";
  available: boolean;
}

interface AccessoryStore {
  items: AccessoryItem[];
  addItem: (
    input: Omit<AccessoryItem, "id">
  ) => void;
  updateItem: (
    id: string,
    input: Omit<AccessoryItem, "id">
  ) => void;
  toggleItem: (id: string) => void;
  deleteItem: (id: string) => void;
}

const defaultItems: AccessoryItem[] = [
  {
    id: "ACC-1",
    name: "Cue Tip",
    price: 300,
    category: "Tips",
    available: true,
  },
  {
    id: "ACC-2",
    name: "Cue Stick",
    price: 3500,
    category: "Sticks",
    available: true,
  },
  {
    id: "ACC-3",
    name: "Glove",
    price: 800,
    category: "Gloves",
    available: true,
  },
  {
    id: "ACC-4",
    name: "Chalk",
    price: 150,
    category: "Chalk",
    available: true,
  },
];

export const useAccessoriesStore =
  create<AccessoryStore>()(
    persist(
      (set) => ({
        items: defaultItems,

        addItem: (input) =>
          set((state) => ({
            items: [
              {
                ...input,
                id: `ACC-${Date.now()}`,
              },
              ...state.items,
            ],
          })),

        updateItem: (id, input) =>
          set((state) => ({
            items: state.items.map((item) =>
              item.id === id
                ? {
                    ...item,
                    ...input,
                  }
                : item
            ),
          })),

        toggleItem: (id) =>
          set((state) => ({
            items: state.items.map((item) =>
              item.id === id
                ? {
                    ...item,
                    available: !item.available,
                  }
                : item
            ),
          })),

        deleteItem: (id) =>
          set((state) => ({
            items: state.items.filter((item) => item.id !== id),
          })),
      }),
      {
        name: "snooker-arena-accessories",
      }
    )
  );
