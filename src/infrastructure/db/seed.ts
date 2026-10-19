import { randomUUID } from 'node:crypto';
import { db, sql } from './client';
import { reviews as reviewsTable } from './schema';
import { DrizzleProductRepository } from '../repositories/DrizzleProductRepository';
import { DrizzleUserRepository } from '../repositories/DrizzleUserRepository';
import { ScryptPasswordHasher } from '../auth/ScryptPasswordHasher';
import { ConsoleDomainEventPublisher } from '../../application/shared/DomainEventPublisher';
import { CreateProductUseCase } from '../../application/product/CreateProductUseCase';
import type { CreateProductInput } from '../../application/product/CreateProductUseCase';
import { RegisterUserUseCase } from '../../application/identity/RegisterUserUseCase';

interface DemoReview {
  authorName: string;
  rating: number;
  comment: string;
}

const DEMO_PASSWORD = 'password123';

const demoSellerEmails = [
  'seller1@medikart.test',
  'seller2@medikart.test',
  'seller3@medikart.test',
];
const demoBuyerEmail = 'buyer@medikart.test';

const demoProducts: Array<CreateProductInput & { sellerIndex: number; reviews: DemoReview[] }> = [
  {
    sellerIndex: 0,
    name: 'Digital Infrared Thermometer',
    description: 'Non-contact infrared thermometer for fast, hygienic temperature checks at home.',
    priceInCents: 89900,
    stockQuantity: 40,
    category: 'Diagnostic Devices',
    features: [
      '1-second instant reading',
      'Non-contact forehead & object mode',
      'Stores last 20 readings',
      'Fever alert with color display',
    ],
    images: [
      'https://commons.wikimedia.org/wiki/Special:FilePath/Digital%20IR-Thermometer.jpg?width=1200',
    ],
    reviews: [
      {
        authorName: 'Rohit N.',
        rating: 5,
        comment: "Reads instantly and is gentle for checking my kid's temperature at night.",
      },
      {
        authorName: 'Ayesha K.',
        rating: 4,
        comment: 'Accurate readings, though it needs fresh batteries often.',
      },
    ],
  },
  {
    sellerIndex: 1,
    name: 'Fingertip Pulse Oximeter',
    description:
      'Compact fingertip device that measures blood oxygen saturation (SpO2) and pulse rate.',
    priceInCents: 129900,
    stockQuantity: 60,
    category: 'Diagnostic Devices',
    features: [
      'Reads SpO2 and pulse rate in seconds',
      'Bright OLED display',
      'Auto power-off to save battery',
      'Lightweight, fits in a pocket',
    ],
    images: [
      'https://commons.wikimedia.org/wiki/Special:FilePath/FingertipPulseOximeterMD300C2.jpg?width=1200',
      'https://commons.wikimedia.org/wiki/Special:FilePath/FingertipPulseOximeter300C2.jpg?width=1200',
    ],
    reviews: [
      {
        authorName: 'Suresh P.',
        rating: 5,
        comment: 'Doctor recommended this for monitoring at home, works great.',
      },
      {
        authorName: 'Fatima R.',
        rating: 5,
        comment: 'Compact and the display is easy to read even without glasses.',
      },
    ],
  },
  {
    sellerIndex: 0,
    name: 'Digital Blood Pressure Monitor',
    description:
      'Automatic upper-arm blood pressure monitor with WHO indicator and irregular heartbeat detection.',
    priceInCents: 219900,
    stockQuantity: 15,
    category: 'Diagnostic Devices',
    features: [
      'Upper-arm cuff fits 22-42 cm',
      'WHO blood pressure indicator',
      'Stores readings for 2 users',
      'Irregular heartbeat detection',
    ],
    images: [
      'https://commons.wikimedia.org/wiki/Special:FilePath/Beurer%20BM26%20sphygmomanometer.jpg?width=1200',
      'https://commons.wikimedia.org/wiki/Special:FilePath/Digital%20Blood%20Pressure%20Monitor.jpg?width=1200',
    ],
    reviews: [
      {
        authorName: 'Vikram S.',
        rating: 4,
        comment: "Matches readings from my clinic's monitor closely.",
      },
      {
        authorName: 'Lakshmi T.',
        rating: 5,
        comment: 'Easy for my parents to use on their own every morning.',
      },
    ],
  },
  {
    sellerIndex: 2,
    name: 'N95 Respirator Masks (Pack of 20)',
    description:
      'NIOSH-certified N95 respirator masks for everyday protection against airborne particles.',
    priceInCents: 59900,
    stockQuantity: 100,
    category: 'PPE & Masks',
    features: [
      'NIOSH N95 certified filtration',
      'Adjustable nose clip for a snug fit',
      'Individually sealed for hygiene',
      'Pack of 20',
    ],
    images: [
      'https://commons.wikimedia.org/wiki/Special:FilePath/N95mask.jpg?width=1200',
      'https://commons.wikimedia.org/wiki/Special:FilePath/3M%209132%20N95%20Mask.jpg?width=1200',
    ],
    reviews: [
      {
        authorName: 'Arjun D.',
        rating: 5,
        comment: 'Comfortable for long wear and the nose clip actually holds shape.',
      },
      {
        authorName: 'Sneha M.',
        rating: 4,
        comment: 'Good quality, wish they came in smaller sizes too.',
      },
      {
        authorName: 'Karan V.',
        rating: 5,
        comment: 'Individually packed, feels hygienic for daily use.',
      },
    ],
  },
  {
    sellerIndex: 1,
    name: 'Digital Body Weighing Scale',
    description: 'Digital bathroom scale with a large backlit display and auto-calibration.',
    priceInCents: 149900,
    stockQuantity: 0,
    category: 'Personal Care & Fitness',
    features: [
      'Tempered glass platform',
      'Auto-calibration & step-on activation',
      'Capacity up to 180 kg',
      'Large backlit LCD display',
    ],
    images: [
      'https://commons.wikimedia.org/wiki/Special:FilePath/Fitness%20digital%20scale%20weight%20loss%20(33837094584).jpg?width=1200',
      'https://commons.wikimedia.org/wiki/Special:FilePath/MyWeigh%20Phoenix%20bathroom%20scale%20(360112654).jpg?width=1200',
    ],
    reviews: [
      {
        authorName: 'Meena J.',
        rating: 4,
        comment: 'Consistent readings every morning, easy to read display.',
      },
    ],
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
  for (const { sellerIndex, reviews, ...input } of demoProducts) {
    const seller = sellers[sellerIndex];
    const created = await createProduct.execute(input, { id: seller.id, role: 'seller' });
    console.log(`Seeded "${created.name}" (${created.id}) for ${seller.email}`);

    if (reviews.length > 0) {
      await db.insert(reviewsTable).values(
        reviews.map((review) => ({
          id: randomUUID(),
          productId: created.id,
          authorName: review.authorName,
          rating: review.rating,
          comment: review.comment,
        })),
      );
      console.log(`  seeded ${reviews.length} review(s)`);
    }
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
