import { db } from '../db/client';
import { DrizzleProductRepository } from '../repositories/DrizzleProductRepository';
import { DrizzleCartRepository } from '../repositories/DrizzleCartRepository';
import { DrizzleUserRepository } from '../repositories/DrizzleUserRepository';
import { DrizzleReviewRepository } from '../repositories/DrizzleReviewRepository';
import { DrizzleOrderRepository } from '../repositories/DrizzleOrderRepository';
import { DrizzleSessionStore } from '../auth/DrizzleSessionStore';
import { ScryptPasswordHasher } from '../auth/ScryptPasswordHasher';
import { DrizzleUnitOfWork } from '../db/DrizzleUnitOfWork';
import { ConsoleDomainEventPublisher } from '../../application/shared/DomainEventPublisher';
import { CreateProductUseCase } from '../../application/product/CreateProductUseCase';
import { UpdateProductUseCase } from '../../application/product/UpdateProductUseCase';
import { DeleteProductUseCase } from '../../application/product/DeleteProductUseCase';
import { GetProductUseCase } from '../../application/product/GetProductUseCase';
import { ListProductsUseCase } from '../../application/product/ListProductsUseCase';
import { ListReviewsForProductUseCase } from '../../application/review/ListReviewsForProductUseCase';
import { GetOrCreateCartUseCase } from '../../application/cart/GetOrCreateCartUseCase';
import { AddItemToCartUseCase } from '../../application/cart/AddItemToCartUseCase';
import { UpdateCartItemQuantityUseCase } from '../../application/cart/UpdateCartItemQuantityUseCase';
import { RemoveCartItemUseCase } from '../../application/cart/RemoveCartItemUseCase';
import { RegisterUserUseCase } from '../../application/identity/RegisterUserUseCase';
import { AuthenticateUserUseCase } from '../../application/identity/AuthenticateUserUseCase';
import { ResolveSessionUseCase } from '../../application/identity/ResolveSessionUseCase';
import { UpdateUserProfileUseCase } from '../../application/identity/UpdateUserProfileUseCase';
import { PlaceOrderUseCase } from '../../application/order/PlaceOrderUseCase';
import { CancelOrderUseCase } from '../../application/order/CancelOrderUseCase';
import { ListOrdersForBuyerUseCase } from '../../application/order/ListOrdersForBuyerUseCase';
import { ListOrdersForVendorUseCase } from '../../application/order/ListOrdersForVendorUseCase';
import { GetSellerDashboardUseCase } from '../../application/analytics/GetSellerDashboardUseCase';

const productRepository = new DrizzleProductRepository(db);
const cartRepository = new DrizzleCartRepository(db);
const userRepository = new DrizzleUserRepository(db);
const reviewRepository = new DrizzleReviewRepository(db);
const orderRepository = new DrizzleOrderRepository(db);
const sessionStore = new DrizzleSessionStore(db);
const passwordHasher = new ScryptPasswordHasher();
const eventPublisher = new ConsoleDomainEventPublisher();
const unitOfWork = new DrizzleUnitOfWork(db);

const getOrCreateCart = new GetOrCreateCartUseCase(cartRepository);

/**
 * Composition root: the only place use cases are wired to concrete
 * repositories. API routes depend on this, never on infrastructure directly.
 */
export const container = {
  createProduct: new CreateProductUseCase(productRepository, eventPublisher),
  updateProduct: new UpdateProductUseCase(productRepository, eventPublisher),
  deleteProduct: new DeleteProductUseCase(productRepository, eventPublisher),
  getProduct: new GetProductUseCase(productRepository),
  listProducts: new ListProductsUseCase(productRepository),
  listReviewsForProduct: new ListReviewsForProductUseCase(reviewRepository),
  getOrCreateCart,
  addItemToCart: new AddItemToCartUseCase(
    cartRepository,
    productRepository,
    getOrCreateCart,
    eventPublisher,
  ),
  updateCartItemQuantity: new UpdateCartItemQuantityUseCase(
    cartRepository,
    productRepository,
    eventPublisher,
  ),
  removeCartItem: new RemoveCartItemUseCase(cartRepository, eventPublisher),
  sessionStore,
  registerUser: new RegisterUserUseCase(userRepository, passwordHasher, eventPublisher),
  authenticateUser: new AuthenticateUserUseCase(userRepository, passwordHasher),
  resolveSession: new ResolveSessionUseCase(sessionStore, userRepository),
  updateUserProfile: new UpdateUserProfileUseCase(userRepository, eventPublisher),
  placeOrder: new PlaceOrderUseCase(unitOfWork, cartRepository, eventPublisher),
  cancelOrder: new CancelOrderUseCase(unitOfWork, eventPublisher),
  listOrdersForBuyer: new ListOrdersForBuyerUseCase(orderRepository),
  listOrdersForVendor: new ListOrdersForVendorUseCase(orderRepository),
  getSellerDashboard: new GetSellerDashboardUseCase(orderRepository, productRepository),
};
