export interface MenuItem {
  id: string;

  name: string;

  price: number;

  category: string;

  available: boolean;

  emoji?: string;

  imageDataUrl?: string;

  imageKey?: string;

  isAvailable?: boolean;

  createdAt?: string;

  updatedAt?: string;

  trackStock?: boolean;

  currentStock?: number;

  lowStockAlertQuantity?: number;

  stockUnit?: string;
}

export interface OrderItem {
  lineId?: string;

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

  participantKey?: string;

  orderedAt?: string;
}

export interface WaitingCustomer {
  id: string;

  name: string;

  orderItems: OrderItem[];

  totalAmount: number;
}
