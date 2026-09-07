export type MenuItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  allergens: string;
  price: number;
  stock: number;
};
export type User = {
  id: string;
  name: string;
  email: string;
  departmentId: string;
  departmentName: string;
  role: 'staff' | 'admin';
  balance: number;
};
export type Space = {
  id: string;
  name: string;
  location: string;
  description: string;
  departmentId: string | null;
  capacity: number;
  occupied: number;
};
export type Order = {
  id: string;
  userName?: string;
  status: string;
  total: number;
  createdAt: number;
  spaceName: string | null;
  items: { name: string; quantity: number; price: number }[];
};
export type LedgerEntry = {
  id: string;
  amount: number;
  description: string;
  createdAt: number;
};
export const MENU: MenuItem[] = [
  {
    id: 'thali',
    name: 'The everyday thali',
    description: 'Dal, seasonal sabzi, rice, two rotis & a little pickle.',
    category: 'Meals',
    allergens: 'Wheat, milk, mustard',
    price: 85,
    stock: 30,
  },
  {
    id: 'bowl',
    name: 'Rajma rice bowl',
    description: 'Slow-cooked kidney beans, fluffy rice & fresh onions.',
    category: 'Meals',
    allergens: 'Milk',
    price: 65,
    stock: 24,
  },
  {
    id: 'sandwich',
    name: 'Grilled garden sandwich',
    description: 'Crunchy vegetables, green chutney & melted cheese.',
    category: 'Quick bites',
    allergens: 'Wheat, milk',
    price: 45,
    stock: 18,
  },
  {
    id: 'dosa',
    name: 'Golden masala dosa',
    description: 'Crisp dosa, spiced potato, sambar & coconut chutney.',
    category: 'Meals',
    allergens: 'Mustard',
    price: 60,
    stock: 15,
  },
  {
    id: 'samosa',
    name: 'Samosa duo',
    description: 'Two golden samosas with tamarind & mint chutneys.',
    category: 'Quick bites',
    allergens: 'Wheat',
    price: 25,
    stock: 4,
  },
  {
    id: 'chai',
    name: 'A proper masala chai',
    description: 'Fresh ginger, warming spices & a well-earned pause.',
    category: 'Beverages',
    allergens: 'Milk',
    price: 15,
    stock: 60,
  },
  {
    id: 'coffee',
    name: 'South Indian filter coffee',
    description: 'A rich, frothy classic. Freshly brewed, always.',
    category: 'Beverages',
    allergens: 'Milk',
    price: 25,
    stock: 40,
  },
  {
    id: 'lime',
    name: 'Fresh lime cooler',
    description: 'Freshly squeezed lime. Light, bright & refreshing.',
    category: 'Beverages',
    allergens: 'None declared',
    price: 30,
    stock: 0,
  },
];
