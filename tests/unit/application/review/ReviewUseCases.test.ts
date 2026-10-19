import { beforeEach, describe, expect, it } from 'vitest';
import { CreateProductUseCase } from '@/application/product/CreateProductUseCase';
import { AddItemToCartUseCase } from '@/application/cart/AddItemToCartUseCase';
import { PlaceOrderUseCase } from '@/application/order/PlaceOrderUseCase';
import { AdvanceOrderFulfillmentUseCase } from '@/application/order/AdvanceOrderFulfillmentUseCase';
import { RegisterUserUseCase } from '@/application/identity/RegisterUserUseCase';
import { UpdateUserProfileUseCase } from '@/application/identity/UpdateUserProfileUseCase';
import { WriteReviewUseCase } from '@/application/review/WriteReviewUseCase';
import { GetProductReviewsUseCase } from '@/application/review/GetProductReviewsUseCase';
import { ConflictError, ForbiddenError, NotFoundError } from '@/domain/shared/DomainError';
import { InMemoryProductRepository } from '../_fakes/InMemoryProductRepository';
import { InMemoryCartRepository } from '../_fakes/InMemoryCartRepository';
import { InMemoryOrderRepository } from '../_fakes/InMemoryOrderRepository';
import { InMemoryUserRepository } from '../_fakes/InMemoryUserRepository';
import { InMemoryReviewRepository } from '../_fakes/InMemoryReviewRepository';
import { InMemoryUnitOfWork } from '../_fakes/InMemoryUnitOfWork';
import { FakePasswordHasher } from '../_fakes/FakePasswordHasher';
import { RecordingEventPublisher } from '../_fakes/RecordingEventPublisher';
import type { RequestingUser } from '@/application/shared/RequestingUser';

describe('Review use cases', () => {
  let products: InMemoryProductRepository;
  let orders: InMemoryOrderRepository;
  let users: InMemoryUserRepository;
  let reviews: InMemoryReviewRepository;
  let events: RecordingEventPublisher;
  let writeReview: WriteReviewUseCase;
  let getReviews: GetProductReviewsUseCase;
  let buyer: RequestingUser;
  let seller: RequestingUser;
  let productId: string;

  async function buyAndReceive(deliver: boolean): Promise<void> {
    const carts = new InMemoryCartRepository();
    const unitOfWork = new InMemoryUnitOfWork({ carts, orders, products });
    await new AddItemToCartUseCase(unitOfWork, events).execute({
      userId: buyer.id,
      productId,
      quantity: 1,
    });
    const order = await new PlaceOrderUseCase(unitOfWork, carts, events).execute({
      buyerId: buyer.id,
      buyerEmail: 'buyer@example.com',
      deliveryAddress: '1 Test Street',
      deliveryPhone: '9876543210',
    });
    const advance = new AdvanceOrderFulfillmentUseCase(unitOfWork, events);
    await advance.execute({ orderId: order.id, status: 'shipped' }, seller);
    if (deliver) {
      await advance.execute({ orderId: order.id, status: 'delivered' }, seller);
    }
  }

  beforeEach(async () => {
    products = new InMemoryProductRepository();
    orders = new InMemoryOrderRepository();
    users = new InMemoryUserRepository();
    reviews = new InMemoryReviewRepository();
    events = new RecordingEventPublisher();
    writeReview = new WriteReviewUseCase(reviews, orders, products, users);
    getReviews = new GetProductReviewsUseCase(reviews, orders);

    const register = new RegisterUserUseCase(users, new FakePasswordHasher(), events);
    const b = await register.execute({
      email: 'buyer@example.com',
      password: 'password123',
      role: 'buyer',
    });
    const s = await register.execute({
      email: 'seller@example.com',
      password: 'password123',
      role: 'seller',
    });
    buyer = { id: b.id, role: 'buyer' };
    seller = { id: s.id, role: 'seller' };
    productId = (
      await new CreateProductUseCase(products, events).execute(
        { name: 'Thermometer', description: '', priceInCents: 49_900, stockQuantity: 10 },
        seller,
      )
    ).id;
  });

  it('lets a buyer review a delivered product once, using their profile name', async () => {
    await new UpdateUserProfileUseCase(users, events).execute(buyer.id, { name: 'Asha K' });
    await buyAndReceive(true);

    const review = await writeReview.execute({ productId, rating: 5, comment: 'Accurate' }, buyer);
    expect(review).toMatchObject({ authorName: 'Asha K', rating: 5, verifiedPurchase: true });

    await expect(
      writeReview.execute({ productId, rating: 1, comment: 'Changed my mind' }, buyer),
    ).rejects.toThrow(ConflictError);

    const page = await getReviews.execute(productId, buyer);
    expect(page).toMatchObject({ count: 1, averageRating: 5, eligibility: 'already-reviewed' });
  });

  it('falls back to "Verified buyer" when the buyer has no profile name', async () => {
    await buyAndReceive(true);
    const review = await writeReview.execute({ productId, rating: 4, comment: '' }, buyer);
    expect(review.authorName).toBe('Verified buyer');
  });

  it('refuses a review before the order is delivered', async () => {
    await buyAndReceive(false);
    await expect(writeReview.execute({ productId, rating: 4, comment: '' }, buyer)).rejects.toThrow(
      ForbiddenError,
    );
    expect((await getReviews.execute(productId, buyer)).eligibility).toBe('not-delivered');
  });

  it('refuses sellers and unknown products', async () => {
    await expect(
      writeReview.execute({ productId, rating: 4, comment: '' }, seller),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      writeReview.execute({ productId: 'missing', rating: 4, comment: '' }, buyer),
    ).rejects.toThrow(NotFoundError);
  });

  it('reports eligibility for anonymous visitors and sellers', async () => {
    expect((await getReviews.execute(productId, null)).eligibility).toBe('login-required');
    expect((await getReviews.execute(productId, seller)).eligibility).toBe('buyers-only');
  });
});
