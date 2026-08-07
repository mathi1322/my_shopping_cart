import { beforeEach, describe, expect, it } from 'vitest';
import { CreateProductUseCase } from '@/application/product/CreateProductUseCase';
import { UpdateProductUseCase } from '@/application/product/UpdateProductUseCase';
import { DeleteProductUseCase } from '@/application/product/DeleteProductUseCase';
import { GetProductUseCase } from '@/application/product/GetProductUseCase';
import { ListProductsUseCase } from '@/application/product/ListProductsUseCase';
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
      const dto = await new GetProductUseCase(repository).execute(created.id);
      expect(dto.id).toBe(created.id);
    });

    it('throws NotFoundError for an unknown product', async () => {
      await expect(new GetProductUseCase(repository).execute('missing-id')).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('ListProductsUseCase', () => {
    it('returns all products when no filter is given', async () => {
      await new CreateProductUseCase(repository, events).execute(validInput(), seller);
      await new CreateProductUseCase(repository, events).execute(
        { ...validInput(), name: 'Keyboard' },
        otherSeller,
      );

      const products = await new ListProductsUseCase(repository).execute();
      expect(products).toHaveLength(2);
    });

    it('filters by vendorId when given', async () => {
      await new CreateProductUseCase(repository, events).execute(validInput(), seller);
      await new CreateProductUseCase(repository, events).execute(
        { ...validInput(), name: 'Keyboard' },
        otherSeller,
      );

      const products = await new ListProductsUseCase(repository).execute({
        vendorId: seller.id,
      });
      expect(products).toHaveLength(1);
      expect(products[0].vendorId).toBe(seller.id);
    });

    it('returns an empty list when there are no products', async () => {
      const products = await new ListProductsUseCase(repository).execute();
      expect(products).toEqual([]);
    });
  });
});
