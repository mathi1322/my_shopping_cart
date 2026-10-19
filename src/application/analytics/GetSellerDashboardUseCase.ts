import { VendorId } from '../../domain/product/VendorId';
import { ProductId } from '../../domain/product/ProductId';
import type { Order } from '../../domain/order/Order';
import type { OrderItem } from '../../domain/order/OrderItem';
import type { OrderRepository } from '../../domain/order/OrderRepository';
import type { ProductRepository } from '../../domain/product/ProductRepository';
import type {
  SellerDashboardDto,
  TopProductStat,
  CategoryStat,
  DailyStat,
  RecentOrderStat,
} from './SellerDashboardDto';

const TREND_WINDOW_DAYS = 14;
const TOP_PRODUCTS_LIMIT = 5;
const RECENT_ORDERS_LIMIT = 5;
const FALLBACK_CATEGORY = 'Other';

interface VendorOrderSlice {
  order: Order;
  items: OrderItem[];
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayLabel(date: Date): string {
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function revenueOf(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.subtotal.cents, 0);
}

function unitsOf(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity.value, 0);
}

function buildProductStats(placed: VendorOrderSlice[]): Map<string, TopProductStat> {
  const stats = new Map<string, TopProductStat>();
  for (const { items } of placed) {
    for (const item of items) {
      const key = item.productId.toString();
      const existing = stats.get(key) ?? {
        productId: key,
        productName: item.productName,
        productImage: item.productImage,
        unitsSold: 0,
        revenueInCents: 0,
      };
      existing.unitsSold += item.quantity.value;
      existing.revenueInCents += item.subtotal.cents;
      stats.set(key, existing);
    }
  }
  return stats;
}

function buildTrend(vendorOrders: VendorOrderSlice[], windowDays: number): DailyStat[] {
  const today = new Date();
  const buckets = new Map<string, DailyStat>();
  for (let i = windowDays - 1; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    const key = dateKey(day);
    buckets.set(key, {
      date: key,
      label: dayLabel(day),
      placedCount: 0,
      cancelledCount: 0,
      revenueInCents: 0,
    });
  }

  for (const { order, items } of vendorOrders) {
    const bucket = buckets.get(dateKey(order.createdAt));
    if (!bucket) continue; // outside the trend window
    if (order.status !== 'cancelled') {
      bucket.placedCount += 1;
      bucket.revenueInCents += revenueOf(items);
    } else {
      bucket.cancelledCount += 1;
    }
  }

  return [...buckets.values()];
}

/** % change in revenue, last 7 days vs the 7 days before — null when the prior period has no revenue to compare against. */
function weekOverWeekDelta(last14Days: DailyStat[]): number | null {
  const previousWeek = last14Days.slice(0, 7).reduce((sum, day) => sum + day.revenueInCents, 0);
  const lastWeek = last14Days.slice(7, 14).reduce((sum, day) => sum + day.revenueInCents, 0);
  if (previousWeek === 0) return null;
  return Math.round(((lastWeek - previousWeek) / previousWeek) * 100);
}

export class GetSellerDashboardUseCase {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(vendorId: string): Promise<SellerDashboardDto> {
    const vendorIdVo = VendorId.fromString(vendorId);
    const orders = await this.orderRepository.findByVendorId(vendorIdVo);

    const vendorOrders: VendorOrderSlice[] = orders.map((order) => ({
      order,
      items: order.items.filter((item) => item.vendorId.equals(vendorIdVo)),
    }));

    // Every order that wasn't cancelled counts as a sale, whatever its delivery stage.
    const placed = vendorOrders.filter(({ order }) => order.status !== 'cancelled');
    const cancelled = vendorOrders.filter(({ order }) => order.status === 'cancelled');

    const currency = vendorOrders[0]?.items[0]?.unitPrice.currencyCode ?? 'INR';
    const totalRevenueInCents = placed.reduce((sum, { items }) => sum + revenueOf(items), 0);
    const totalUnitsSold = placed.reduce((sum, { items }) => sum + unitsOf(items), 0);
    const uniqueCustomers = new Set(vendorOrders.map(({ order }) => order.buyerId)).size;
    const averageOrderValueInCents =
      placed.length > 0 ? Math.round(totalRevenueInCents / placed.length) : 0;
    const cancellationRatePercent =
      vendorOrders.length > 0 ? Math.round((cancelled.length / vendorOrders.length) * 100) : 0;

    const productStats = buildProductStats(placed);
    const topProducts = [...productStats.values()]
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, TOP_PRODUCTS_LIMIT);

    // Category is looked up live against the current Product, not snapshotted on
    // OrderItem — so if a seller recategorizes a product after selling it, past
    // revenue reports under the new category rather than what it was at sale time.
    // Acceptable for a reporting view; would need a snapshot column if this ever
    // has to match point-in-time financial records exactly.
    const categoryTotals = new Map<string, CategoryStat>();
    for (const [productId, stat] of productStats) {
      const product = await this.productRepository.findById(ProductId.fromString(productId));
      const category = product?.category ?? FALLBACK_CATEGORY;
      const existing = categoryTotals.get(category) ?? {
        category,
        unitsSold: 0,
        revenueInCents: 0,
      };
      existing.unitsSold += stat.unitsSold;
      existing.revenueInCents += stat.revenueInCents;
      categoryTotals.set(category, existing);
    }
    const categoryBreakdown = [...categoryTotals.values()].sort(
      (a, b) => b.revenueInCents - a.revenueInCents,
    );

    const last14Days = buildTrend(vendorOrders, TREND_WINDOW_DAYS);
    const revenueDeltaPercent = weekOverWeekDelta(last14Days);

    const recentOrders: RecentOrderStat[] = vendorOrders
      .slice(0, RECENT_ORDERS_LIMIT)
      .map(({ order, items }) => ({
        id: order.id.toString(),
        buyerEmail: order.buyerEmail,
        createdAt: order.createdAt.toISOString(),
        status: order.statusFor(vendorIdVo),
        itemCount: unitsOf(items),
        totalInCents: revenueOf(items),
      }));

    return {
      currency,
      totalOrders: vendorOrders.length,
      placedOrders: placed.length,
      cancelledOrders: cancelled.length,
      cancellationRatePercent,
      uniqueCustomers,
      totalRevenueInCents,
      averageOrderValueInCents,
      totalUnitsSold,
      revenueDeltaPercent,
      topProducts,
      categoryBreakdown,
      last14Days,
      recentOrders,
    };
  }
}
