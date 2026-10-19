import { useEffect, useState } from 'preact/hooks';
import { PRODUCT_CATEGORIES } from '../domain/product/ProductCategory';
import { fetchJson } from '../lib/ui/fetchJson';

interface ProductDto {
  id: string;
  vendorId: string;
  name: string;
  description: string;
  priceInCents: number;
  currency: string;
  stockQuantity: number;
  category: string;
  images: string[];
}

interface Props {
  vendorId: string;
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(cents / 100);
}

function toDollarsString(cents: number): string {
  return (cents / 100).toFixed(2);
}

function toCents(dollars: string): number {
  return Math.round(Number(dollars) * 100);
}

const emptyForm = {
  name: '',
  description: '',
  price: '',
  stock: '',
  category: PRODUCT_CATEGORIES[0] as string,
  images: [] as string[],
};

interface ImageUrlsFieldProps {
  images: string[];
  onChange: (images: string[]) => void;
}

function ImageUrlsField({ images, onChange }: ImageUrlsFieldProps) {
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);

  function addUrl() {
    const url = urlInput.trim();
    if (!url) return;
    // Same rule as the server, checked up front: the page's CSP only loads https images,
    // so an http URL could neither be previewed nor shown to shoppers.
    if (!/^https:\/\/\S+$/i.test(url)) {
      setUrlError('Image URLs must start with https://');
      return;
    }
    setUrlError(null);
    onChange([...images, url]);
    setUrlInput('');
  }

  function removeUrl(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  return (
    <div class="sm:col-span-2">
      <div class="flex gap-2">
        <input
          type="url"
          aria-label="Image URL"
          placeholder="Image URL (https://…)"
          value={urlInput}
          onInput={(e) => setUrlInput((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addUrl();
            }
          }}
          class="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={addUrl}
          class="bg-brand hover:bg-brand-dark rounded-full px-3 py-2 text-xs font-bold text-white uppercase"
        >
          Add
        </button>
      </div>
      {urlError && (
        <p role="alert" class="mt-1 text-xs text-red-700">
          {urlError}
        </p>
      )}
      {images.length > 0 && (
        <div class="mt-2 flex flex-wrap gap-2">
          {images.map((url, index) => (
            <div key={url} class="relative h-16 w-16 shrink-0">
              <img
                src={url}
                alt=""
                class="h-16 w-16 rounded border border-slate-200 object-cover"
              />
              <button
                type="button"
                aria-label="Remove image"
                onClick={() => removeUrl(index)}
                class="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-xs text-white hover:bg-slate-900"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SellerProductManager({ vendorId }: Props) {
  const [products, setProducts] = useState<ProductDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newProduct, setNewProduct] = useState(emptyForm);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState(emptyForm);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [pageInfo, setPageInfo] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loadingMore, setLoadingMore] = useState(false);

  /** Page 1 replaces the list (e.g. after a change); later pages append ("Load more"). */
  async function loadProducts(page = 1) {
    const result = await fetchJson<{
      products: ProductDto[];
      page: number;
      totalPages: number;
      total: number;
    }>(`/api/products?vendorId=${encodeURIComponent(vendorId)}&page=${page}&pageSize=24`);
    if (!result.ok) {
      setError(`Could not load your products: ${result.message}`);
      return;
    }
    const { products: pageProducts, totalPages, total } = result.data;
    setProducts((current) =>
      page === 1 || !current ? pageProducts : [...current, ...pageProducts],
    );
    setPageInfo({ page, totalPages, total });
  }

  async function loadMore() {
    setLoadingMore(true);
    await loadProducts(pageInfo.page + 1);
    setLoadingMore(false);
  }

  useEffect(() => {
    loadProducts();
  }, []);

  async function handleCreate(event: Event) {
    event.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const result = await fetchJson<ProductDto>('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProduct.name,
          description: newProduct.description,
          priceInCents: toCents(newProduct.price),
          stockQuantity: Number(newProduct.stock),
          category: newProduct.category,
          images: newProduct.images,
        }),
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setNewProduct(emptyForm);
      await loadProducts();
    } finally {
      setCreating(false);
    }
  }

  function startEdit(product: ProductDto) {
    setEditingId(product.id);
    setEditDraft({
      name: product.name,
      description: product.description,
      price: toDollarsString(product.priceInCents),
      stock: String(product.stockQuantity),
      category: product.category,
      images: product.images,
    });
  }

  async function saveEdit(productId: string) {
    setError(null);
    setSavingId(productId);
    try {
      const result = await fetchJson<ProductDto>(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editDraft.name,
          description: editDraft.description,
          priceInCents: toCents(editDraft.price),
          stockQuantity: Number(editDraft.stock),
          category: editDraft.category,
          images: editDraft.images,
        }),
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setEditingId(null);
      await loadProducts();
    } finally {
      setSavingId(null);
    }
  }

  async function deleteProduct(productId: string) {
    if (!window.confirm('Delete this product? This cannot be undone.')) return;
    setError(null);
    setSavingId(productId);
    try {
      const result = await fetchJson<null>(`/api/products/${productId}`, { method: 'DELETE' });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      await loadProducts();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div class="space-y-6">
      {error && <p class="rounded bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <form onSubmit={handleCreate} class="rounded bg-white p-4 shadow-sm">
        <p class="mb-3 text-sm font-medium text-slate-500 uppercase">Add a product</p>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            required
            aria-label="Product name"
            placeholder="Product name"
            value={newProduct.name}
            onInput={(e) =>
              setNewProduct({ ...newProduct, name: (e.target as HTMLInputElement).value })
            }
            class="rounded border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
          />
          <textarea
            aria-label="Description"
            placeholder="Description"
            value={newProduct.description}
            onInput={(e) =>
              setNewProduct({
                ...newProduct,
                description: (e.target as HTMLTextAreaElement).value,
              })
            }
            class="rounded border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
            rows={2}
          />
          <input
            required
            type="number"
            step="0.01"
            min="0"
            aria-label="Price (INR)"
            placeholder="Price (INR)"
            value={newProduct.price}
            onInput={(e) =>
              setNewProduct({ ...newProduct, price: (e.target as HTMLInputElement).value })
            }
            class="rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            required
            type="number"
            min="0"
            step="1"
            aria-label="Stock quantity"
            placeholder="Stock quantity"
            value={newProduct.stock}
            onInput={(e) =>
              setNewProduct({ ...newProduct, stock: (e.target as HTMLInputElement).value })
            }
            class="rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            aria-label="Category"
            value={newProduct.category}
            onInput={(e) =>
              setNewProduct({ ...newProduct, category: (e.target as HTMLSelectElement).value })
            }
            class="rounded border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
          >
            {PRODUCT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <ImageUrlsField
            images={newProduct.images}
            onChange={(images) => setNewProduct({ ...newProduct, images })}
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          class="bg-brand hover:bg-brand-dark mt-3 rounded-full px-4 py-2 text-xs font-bold tracking-wide text-white uppercase disabled:opacity-60"
        >
          {creating ? 'Adding…' : 'Add product'}
        </button>
      </form>

      <div class="rounded bg-white shadow-sm">
        <p class="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-500 uppercase">
          Your listings {products ? `(${pageInfo.total})` : ''}
        </p>

        {!products ? (
          <p class="p-4 text-sm text-slate-500">Loading…</p>
        ) : products.length === 0 ? (
          <p class="p-4 text-sm text-slate-500">You haven't listed any products yet.</p>
        ) : (
          <ul class="divide-y divide-slate-100">
            {products.map((product) =>
              editingId === product.id ? (
                <li key={product.id} class="p-4">
                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      aria-label="Product name"
                      value={editDraft.name}
                      onInput={(e) =>
                        setEditDraft({ ...editDraft, name: (e.target as HTMLInputElement).value })
                      }
                      class="rounded border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
                    />
                    <textarea
                      aria-label="Description"
                      value={editDraft.description}
                      onInput={(e) =>
                        setEditDraft({
                          ...editDraft,
                          description: (e.target as HTMLTextAreaElement).value,
                        })
                      }
                      class="rounded border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
                      rows={2}
                    />
                    <input
                      aria-label="Price (INR)"
                      type="number"
                      step="0.01"
                      min="0"
                      value={editDraft.price}
                      onInput={(e) =>
                        setEditDraft({ ...editDraft, price: (e.target as HTMLInputElement).value })
                      }
                      class="rounded border border-slate-300 px-3 py-2 text-sm"
                    />
                    <input
                      aria-label="Stock quantity"
                      type="number"
                      min="0"
                      step="1"
                      value={editDraft.stock}
                      onInput={(e) =>
                        setEditDraft({ ...editDraft, stock: (e.target as HTMLInputElement).value })
                      }
                      class="rounded border border-slate-300 px-3 py-2 text-sm"
                    />
                    <select
                      aria-label="Category"
                      value={editDraft.category}
                      onInput={(e) =>
                        setEditDraft({
                          ...editDraft,
                          category: (e.target as HTMLSelectElement).value,
                        })
                      }
                      class="rounded border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
                    >
                      {PRODUCT_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                    <ImageUrlsField
                      images={editDraft.images}
                      onChange={(images) => setEditDraft({ ...editDraft, images })}
                    />
                  </div>
                  <div class="mt-3 flex gap-3">
                    <button
                      onClick={() => saveEdit(product.id)}
                      disabled={savingId === product.id}
                      class="bg-brand hover:bg-brand-dark rounded-full px-3 py-1.5 text-xs font-bold text-white uppercase disabled:opacity-60"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      class="text-xs font-semibold text-slate-500 uppercase hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </li>
              ) : (
                <li key={product.id} class="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div class="flex items-center gap-3">
                    {product.images[0] && (
                      <img
                        src={product.images[0]}
                        alt=""
                        class="h-12 w-12 shrink-0 rounded border border-slate-200 object-cover"
                      />
                    )}
                    <div>
                      <p class="font-medium text-slate-800">{product.name}</p>
                      <p class="text-sm text-slate-500">
                        {formatMoney(product.priceInCents, product.currency)} ·{' '}
                        <span class={product.stockQuantity > 0 ? 'text-green-700' : 'text-red-600'}>
                          {product.stockQuantity > 0
                            ? `${product.stockQuantity} in stock`
                            : 'Out of stock'}
                        </span>
                      </p>
                      <p class="text-xs text-slate-500">{product.category}</p>
                    </div>
                  </div>
                  <div class="flex gap-4">
                    <button
                      onClick={() => startEdit(product)}
                      class="text-brand text-sm font-semibold uppercase hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteProduct(product.id)}
                      disabled={savingId === product.id}
                      class="text-sm font-semibold text-red-600 uppercase hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
        {products && pageInfo.page < pageInfo.totalPages && (
          <div class="border-t border-slate-100 p-4 text-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              class="border-brand text-brand rounded-full border bg-white px-5 py-2 text-sm font-semibold hover:bg-blue-50 disabled:opacity-60"
            >
              {loadingMore
                ? 'Loading…'
                : `Load more listings (${products.length} of ${pageInfo.total})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
