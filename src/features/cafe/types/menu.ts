export interface MenuItem {
  id: string;

  name: string;

  price: number;

  category:
    | "Snacks"
    | "Fast Food"
    | "Drinks"
    | "Tea / Coffee"
    | "Desserts"
    | "Other";

  available: boolean;

  emoji?: string;

  isAvailable?: boolean;

  createdAt?: string;

  updatedAt?: string;
}

export interface OrderItem {
  menuItemId: string;

  name: string;

  price: number;

  quantity: number;

  subtotal: number;

  timeAdded: Date;

  tableId?: number;

  sessionId?: string;

  customerName?: string;

  playerName?: string;

  playerId?: string;

  orderedAt?: string;
}

export interface WaitingCustomer {
  id: string;

  name: string;

  orderItems: OrderItem[];

  totalAmount: number;
}
