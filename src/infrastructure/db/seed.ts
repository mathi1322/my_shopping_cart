import { db, sql } from './client';
import { DrizzleProductRepository } from '../repositories/DrizzleProductRepository';
import { DrizzleUserRepository } from '../repositories/DrizzleUserRepository';
import { ScryptPasswordHasher } from '../auth/ScryptPasswordHasher';
import { ConsoleDomainEventPublisher } from '../../application/shared/DomainEventPublisher';
import { CreateProductUseCase } from '../../application/product/CreateProductUseCase';
import type { CreateProductInput } from '../../application/product/CreateProductUseCase';
import { RegisterUserUseCase } from '../../application/identity/RegisterUserUseCase';

const DEMO_PASSWORD = 'password123';

const demoSellerEmails = [
  'seller1@shopkart.test',
  'seller2@shopkart.test',
  'seller3@shopkart.test',
];
const demoBuyerEmail = 'buyer@shopkart.test';

const demoProducts: Array<CreateProductInput & { sellerIndex: number }> = [
  {
    sellerIndex: 0,
    name: 'Wireless Mouse',
    description: 'A reliable wireless mouse with a 12-month battery life.',
    priceInCents: 1999,
    stockQuantity: 25,
  },
  {
    sellerIndex: 1,
    name: 'Mechanical Keyboard',
    description: 'Tactile switches with per-key RGB backlighting.',
    priceInCents: 8999,
    stockQuantity: 12,
  },
  {
    sellerIndex: 0,
    name: 'USB-C Hub',
    description: '7-in-1 hub with HDMI, Ethernet, and an SD card reader.',
    priceInCents: 3499,
    stockQuantity: 30,
  },
  {
    sellerIndex: 2,
    name: '27" 4K Monitor',
    description: 'IPS panel, 99% sRGB, height-adjustable stand.',
    priceInCents: 32999,
    stockQuantity: 8,
  },
  {
    sellerIndex: 1,
    name: 'Noise-Cancelling Headphones',
    description: 'Over-ear, 30-hour battery, active noise cancellation.',
    priceInCents: 24999,
    stockQuantity: 0,
  },
];

async function main(): Promise<void> {
  const productRepository = new DrizzleProductRepository(db);
  const userRepository = new DrizzleUserRepository(db);
  const eventPublisher = new ConsoleDomainEventPublisher();
  const passwordHasher = new ScryptPasswordHasher();

  const existingProducts = await productRepository.findAll();
  if (existingProducts.length > 0) {
    console.log(`Skipping seed — ${existingProducts.length} product(s) already exist.`);
    return;
  }

  const registerUser = new RegisterUserUseCase(userRepository, passwordHasher, eventPublisher);

  console.log(`Registering demo accounts (password for all: "${DEMO_PASSWORD}")...`);
  const sellers = [];
  for (const email of demoSellerEmails) {
    const user = await registerUser.execute({ email, password: DEMO_PASSWORD, role: 'seller' });
    console.log(`  seller  ${user.email}`);
    sellers.push(user);
  }
  const buyer = await registerUser.execute({
    email: demoBuyerEmail,
    password: DEMO_PASSWORD,
    role: 'buyer',
  });
  console.log(`  buyer   ${buyer.email}`);

  const createProduct = new CreateProductUseCase(productRepository, eventPublisher);
  for (const { sellerIndex, ...input } of demoProducts) {
    const seller = sellers[sellerIndex];
    const created = await createProduct.execute(input, { id: seller.id, role: 'seller' });
    console.log(`Seeded "${created.name}" (${created.id}) for ${seller.email}`);
  }
}

main()
  .then(() => {
    console.log('Seeding complete.');
  })
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
