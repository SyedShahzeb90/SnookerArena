export interface MenuItem {
  id: string;

  name: string;

  price: number;

  category:
    | "Snacks"
    | "Fast Food"
    | "Drinks"
    | "Desserts";

  available: boolean;
}

export interface OrderItem {
  menuItemId: string;

  name: string;

  price: number;

  quantity: number;

  subtotal: number;

  timeAdded: Date;
}

export interface WaitingCustomer {
  id: string;

  name: string;

  orderItems: OrderItem[];

  totalAmount: number;
}
