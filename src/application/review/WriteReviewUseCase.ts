import { ProductId } from '../../domain/product/ProductId';
import { UserId } from '../../domain/identity/UserId';
import { writeReview } from '../../domain/review/Review';
import { ConflictError, ForbiddenError, NotFoundError } from '../../domain/shared/DomainError';
import type { OrderRepository } from '../../domain/order/OrderRepository';
import type { ProductRepository } from '../../domain/product/ProductRepository';
import type { ReviewRepository } from '../../domain/review/ReviewRepository';
import type { UserRepository } from '../../domain/identity/UserRepository';
import type { RequestingUser } from '../shared/RequestingUser';
import { toReviewDto, type ReviewDto } from './ReviewDto';

export interface WriteReviewCommand {
  productId: string;
  rating: number;
  comment: string;
}

export const ANONYMOUS_REVIEWER_NAME = 'Verified buyer';

/** Only a buyer who received the product may review it, once. */
export class WriteReviewUseCase {
  constructor(
    private readonly reviewRepository: ReviewRepository,
    private readonly orderRepository: OrderRepository,
    private readonly productRepository: ProductRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(command: WriteReviewCommand, author: RequestingUser): Promise<ReviewDto> {
    if (author.role !== 'buyer') {
      throw new ForbiddenError('Only buyers can review products');
    }
    const productId = ProductId.fromString(command.productId);
    if (!(await this.productRepository.findById(productId))) {
      throw new NotFoundError(`Product ${command.productId} not found`);
    }
    if (!(await this.orderRepository.hasDeliveredItem(author.id, productId))) {
      throw new ForbiddenError('You can review a product once your order of it has been delivered');
    }

    const user = await this.userRepository.findById(UserId.fromString(author.id));
    const review = writeReview({
      productId: command.productId,
      authorId: author.id,
      authorName: user?.name?.trim() || ANONYMOUS_REVIEWER_NAME,
      rating: command.rating,
      comment: command.comment,
    });

    if (!(await this.reviewRepository.create(review))) {
      throw new ConflictError("You've already reviewed this product");
    }
    return toReviewDto(review);
  }
}
