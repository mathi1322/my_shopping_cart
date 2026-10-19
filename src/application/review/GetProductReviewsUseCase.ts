import { ProductId } from '../../domain/product/ProductId';
import type { OrderRepository } from '../../domain/order/OrderRepository';
import type { ReviewRepository } from '../../domain/review/ReviewRepository';
import type { RequestingUser } from '../shared/RequestingUser';
import { toReviewDto, type ReviewDto } from './ReviewDto';

const REVIEWS_SHOWN = 20;

/** Why the current viewer can or can't write a review — drives what the product page shows. */
export type ReviewEligibility =
  'eligible' | 'login-required' | 'buyers-only' | 'not-delivered' | 'already-reviewed';

export interface ProductReviewsDto {
  reviews: ReviewDto[];
  count: number;
  averageRating: number | null;
  eligibility: ReviewEligibility;
}

export class GetProductReviewsUseCase {
  constructor(
    private readonly reviewRepository: ReviewRepository,
    private readonly orderRepository: OrderRepository,
  ) {}

  async execute(productIdValue: string, viewer: RequestingUser | null): Promise<ProductReviewsDto> {
    const productId = ProductId.fromString(productIdValue);
    const [reviews, summary, eligibility] = await Promise.all([
      this.reviewRepository.findByProductId(productId, REVIEWS_SHOWN),
      this.reviewRepository.summaryFor(productId),
      this.eligibilityOf(productId, viewer),
    ]);
    return {
      reviews: reviews.map(toReviewDto),
      count: summary.count,
      averageRating: summary.averageRating,
      eligibility,
    };
  }

  private async eligibilityOf(
    productId: ProductId,
    viewer: RequestingUser | null,
  ): Promise<ReviewEligibility> {
    if (!viewer) return 'login-required';
    if (viewer.role !== 'buyer') return 'buyers-only';
    if (await this.reviewRepository.hasReviewed(productId, viewer.id)) return 'already-reviewed';
    if (!(await this.orderRepository.hasDeliveredItem(viewer.id, productId))) {
      return 'not-delivered';
    }
    return 'eligible';
  }
}
