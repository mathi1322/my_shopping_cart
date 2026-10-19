import { beforeEach, describe, expect, it } from 'vitest';
import { CreateProductUseCase } from '@/application/product/CreateProductUseCase';
import { UpdateProductUseCase } from '@/application/product/UpdateProductUseCase';
import { DeleteProductUseCase } from '@/application/product/DeleteProductUseCase';
import { GetProductUseCase } from '@/application/product/GetProductUseCase';
import { SearchProductsUseCase } from '@/application/product/SearchProductsUseCase';
import { InMemoryVendorDirectory } from '../_fakes/InMemoryVendorDirectory';
import { ValidationError, NotFoundError, ForbiddenError } from '@/domain/shared/DomainError';
import { InMemoryProductRepository } from '../_fakes/InMemoryProductRepository';
import { RecordingEventPublisher } from '../_fakes/RecordingEventPublisher';

const seller = { id: 'seller-1', role: 'seller' as const };
const otherSeller = { id: 'seller-2', role: 'seller' as const };
const buyer = { id: 'buyer-1', role: 'buyer' as const };

function validInput() {
  return {
    name: 'Wireless Mouse',
    description: 'A reliable wireless mouse',
    priceInCents: 1999,
    stockQuantity: 10,
  };
}

describe('Product use cases', () => {
  let repository: InMemoryProductRepository;
  let events: RecordingEventPublisher;

  beforeEach(() => {
    repository = new InMemoryProductRepository();
    events = new RecordingEventPublisher();
  });

  describe('CreateProductUseCase', () => {
    it('persists a new product owned by the requesting seller and publishes a ProductCreated event', async () => {
      const useCase = new CreateProductUseCase(repository, events);

      const dto = await useCase.execute(validInput(), seller);

      expect(dto.name).toBe('Wireless Mouse');
      expect(dto.vendorId).toBe(seller.id);
      expect(await repository.findAll()).toHaveLength(1);
      expect(events.published).toHaveLength(1);
      expect(events.published[0].name).toBe('product.created');
    });

    it('rejects invalid input via the domain invariants', async () => {
      const useCase = new CreateProductUseCase(repository, events);
      await expect(useCase.execute({ ...validInput(), name: '' }, seller)).rejects.toThrow(
        ValidationError,
      );
    });

    it('throws ForbiddenError when a buyer tries to create a product', async () => {
      const useCase = new CreateProductUseCase(repository, events);
      await expect(useCase.execute(validInput(), buyer)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('UpdateProductUseCase', () => {
    it('updates a product owned by the requesting seller', async () => {
      const created = await new CreateProductUseCase(repository, events).execute(
        validInput(),
        seller,
      );
      const useCase = new UpdateProductUseCase(repository, events);

      const updated = await useCase.execute(created.id, { priceInCents: 2500 }, seller);

      expect(updated.priceInCents).toBe(2500);
      expect(events.published.at(-1)?.name).toBe('product.updated');
    });

    it('throws NotFoundError for an unknown product', async () => {
      const useCase = new UpdateProductUseCase(repository, events);
      await expect(useCase.execute('missing-id', { priceInCents: 100 }, seller)).rejects.toThrow(
        NotFoundError,
      );
    });

    it('throws ForbiddenError when a different seller tries to update the product', async () => {
      const created = await new CreateProductUseCase(repository, events).execute(
        validInput(),
        seller,
      );
      const useCase = new UpdateProductUseCase(repository, events);

      await expect(useCase.execute(created.id, { priceInCents: 100 }, otherSeller)).rejects.toThrow(
        ForbiddenError,
      );
    });

    it('throws ForbiddenError when a buyer tries to update the product', async () => {
      const created = await new CreateProductUseCase(repository, events).execute(
        validInput(),
        seller,
      );
      const useCase = new UpdateProductUseCase(repository, events);

      await expect(useCase.execute(created.id, { priceInCents: 100 }, buyer)).rejects.toThrow(
        ForbiddenError,
      );
    });
  });

  describe('DeleteProductUseCase', () => {
    it('removes a product owned by the requesting seller and publishes a ProductDeleted event', async () => {
      const created = await new CreateProductUseCase(repository, events).execute(
        validInput(),
        seller,
      );
      const useCase = new DeleteProductUseCase(repository, events);

      await useCase.execute(created.id, seller);

      expect(await repository.findAll()).toHaveLength(0);
      expect(events.published.at(-1)?.name).toBe('product.deleted');
    });

    it('throws NotFoundError for an unknown product', async () => {
      const useCase = new DeleteProductUseCase(repository, events);
      await expect(useCase.execute('missing-id', seller)).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when a different seller tries to delete the product', async () => {
      const created = await new CreateProductUseCase(repository, events).execute(
        validInput(),
        seller,
      );
      const useCase = new DeleteProductUseCase(repository, events);

      await expect(useCase.execute(created.id, otherSeller)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('GetProductUseCase', () => {
    it('returns the product DTO', async () => {
      const created = await new CreateProductUseCase(repository, events).execute(
        validInput(),
        seller,
      );
      const dto = await new GetProductUseCase(repository, new InMemoryVendorDirectory()).execute(
        created.id,
      );
      expect(dto.id).toBe(created.id);
    });

    it('throws NotFoundError for an unknown product', async () => {
      await expect(
        new GetProductUseCase(repository, new InMemoryVendorDirectory()).execute('missing-id'),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('SearchProductsUseCase', () => {
    let vendors: InMemoryVendorDirectory;
    let search: SearchProductsUseCase;

    beforeEach(() => {
      vendors = new InMemoryVendorDirectory();
      search = new SearchProductsUseCase(repository, vendors);
    });

    async function create(overrides: Record<string, unknown>, owner = seller) {
      return new CreateProductUseCase(repository, events).execute(
        { ...validInput(), ...overrides },
        owner,
      );
    }

    it('returns products newest first with the seller display name', async () => {
      vendors.set(seller.id, 'CareWell Medical');
      await create({ name: 'Older' });
      await new Promise((resolve) => setTimeout(resolve, 2));
      await create({ name: 'Newer' }, otherSeller);

      const result = await search.execute();
      expect(result.products.map((p) => p.name)).toEqual(['Newer', 'Older']);
      expect(result.products[1].vendorName).toBe('CareWell Medical');
      // A seller with no profile name falls back to a neutral label, never their id.
      expect(result.products[0].vendorName).toBe('MediKart seller');
      expect(result).toMatchObject({ total: 2, page: 1, totalPages: 1 });
    });

    it('filters by vendor, text, category, price and stock', async () => {
      await create({
        name: 'Pulse Oximeter',
        priceInCents: 150_000,
        category: 'Diagnostic Devices',
      });
      await create({ name: 'N95 Masks', priceInCents: 50_000, category: 'PPE & Masks' });
      await create({ name: 'Out of stock thing', stockQuantity: 0 });
      await create({ name: 'Theirs', priceInCents: 50_000 }, otherSeller);

      const names = async (query: Parameters<typeof search.execute>[0]) =>
        (await search.execute(query)).products.map((p) => p.name).sort();

      expect(await names({ vendorId: otherSeller.id })).toEqual(['Theirs']);
      expect(await names({ text: 'OXIM' })).toEqual(['Pulse Oximeter']);
      expect(await names({ categories: ['PPE & Masks'] })).toEqual(['N95 Masks']);
      expect(await names({ minPriceCents: 100_000 })).toEqual(['Pulse Oximeter']);
      expect(
        await names({ minPriceCents: 40_000, maxPriceCents: 60_000, vendorId: seller.id }),
      ).toEqual(['N95 Masks']);
      expect(await names({ inStockOnly: true, vendorId: seller.id })).not.toContain(
        'Out of stock thing',
      );
    });

    it('pages results and clamps out-of-range page sizes', async () => {
      for (let i = 0; i < 5; i += 1) {
        await create({ name: `Product ${i}` });
      }
      const page2 = await search.execute({ page: 2, pageSize: 2 });
      expect(page2.products).toHaveLength(2);
      expect(page2).toMatchObject({ total: 5, page: 2, pageSize: 2, totalPages: 3 });

      const clamped = await search.execute({ page: -4, pageSize: 10_000 });
      expect(clamped).toMatchObject({ page: 1, pageSize: 100 });
    });

    it('lists the categories in use for the filter sidebar', async () => {
      await create({ category: 'PPE & Masks' });
      await create({ category: 'Diagnostic Devices' }, otherSeller);

      expect((await search.execute()).categories).toEqual(['Diagnostic Devices', 'PPE & Masks']);
      expect((await search.execute({ vendorId: seller.id })).categories).toEqual(['PPE & Masks']);
    });
  });
});
