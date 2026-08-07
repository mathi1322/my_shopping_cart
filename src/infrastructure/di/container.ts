import { db } from '../db/client';
import { DrizzleProductRepository } from '../repositories/DrizzleProductRepository';
import { DrizzleCartRepository } from '../repositories/DrizzleCartRepository';
import { DrizzleUserRepository } from '../repositories/DrizzleUserRepository';
import { DrizzleSessionStore } from '../auth/DrizzleSessionStore';
import { ScryptPasswordHasher } from '../auth/ScryptPasswordHasher';
import { ConsoleDomainEventPublisher } from '../../application/shared/DomainEventPublisher';
import { CreateProductUseCase } from '../../application/product/CreateProductUseCase';
import { UpdateProductUseCase } from '../../application/product/UpdateProductUseCase';
import { DeleteProductUseCase } from '../../application/product/DeleteProductUseCase';
import { GetProductUseCase } from '../../application/product/GetProductUseCase';
import { ListProductsUseCase } from '../../application/product/ListProductsUseCase';
import { GetOrCreateCartUseCase } from '../../application/cart/GetOrCreateCartUseCase';
import { AddItemToCartUseCase } from '../../application/cart/AddItemToCartUseCase';
import { UpdateCartItemQuantityUseCase } from '../../application/cart/UpdateCartItemQuantityUseCase';
import { RemoveCartItemUseCase } from '../../application/cart/RemoveCartItemUseCase';
import { RegisterUserUseCase } from '../../application/identity/RegisterUserUseCase';
import { AuthenticateUserUseCase } from '../../application/identity/AuthenticateUserUseCase';
import { ResolveSessionUseCase } from '../../application/identity/ResolveSessionUseCase';

const productRepository = new DrizzleProductRepository(db);
const cartRepository = new DrizzleCartRepository(db);
const userRepository = new DrizzleUserRepository(db);
const sessionStore = new DrizzleSessionStore(db);
const passwordHasher = new ScryptPasswordHasher();
const eventPublisher = new ConsoleDomainEventPublisher();

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
};
