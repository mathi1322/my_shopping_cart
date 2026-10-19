import type { OrderStatus } from '../../domain/order/Order';

export interface TopProductStat {
  productId: string;
  productName: string;
  productImage: string | null;
  unitsSold: number;
  revenueInCents: number;
}

export interface CategoryStat {
  category: string;
  unitsSold: number;
  revenueInCents: number;
}

export interface DailyStat {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "Aug 8"
  placedCount: number;
  cancelledCount: number;
  revenueInCents: number;
}

export interface RecentOrderStat {
  id: string;
  buyerEmail: string;
  createdAt: string;
  status: OrderStatus;
  itemCount: number;
  totalInCents: number;
}

export interface SellerDashboardDto {
  currency: string;
  totalOrders: number;
  placedOrders: number;
  cancelledOrders: number;
  cancellationRatePercent: number;
  uniqueCustomers: number;
  totalRevenueInCents: number;
  averageOrderValueInCents: number;
  totalUnitsSold: number;
  /** % change in revenue, last 7 days vs the 7 days before that. Null when there's not enough history to compare. */
  revenueDeltaPercent: number | null;
  topProducts: TopProductStat[];
  categoryBreakdown: CategoryStat[];
  last14Days: DailyStat[];
  recentOrders: RecentOrderStat[];
}
