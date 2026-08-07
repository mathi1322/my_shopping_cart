import { ProductId } from '../../domain/product/ProductId';
import type { ReviewRepository } from '../../domain/review/ReviewRepository';
import { toReviewDto, type ReviewDto } from './ReviewDto';

export class ListReviewsForProductUseCase {
  constructor(private readonly reviewRepository: ReviewRepository) {}

  async execute(productId: string): Promise<ReviewDto[]> {
    const reviews = await this.reviewRepository.findByProductId(ProductId.fromString(productId));
    return reviews.map(toReviewDto);
  }
}
