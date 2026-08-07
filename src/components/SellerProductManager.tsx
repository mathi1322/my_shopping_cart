import { useEffect, useState } from 'preact/hooks';

interface ProductDto {
  id: string;
  vendorId: string;
  name: string;
  description: string;
  priceInCents: number;
  currency: string;
  stockQuantity: number;
}

interface Props {
  vendorId: string;
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

function toDollarsString(cents: number): string {
  return (cents / 100).toFixed(2);
}

function toCents(dollars: string): number {
  return Math.round(Number(dollars) * 100);
}

const emptyForm = { name: '', description: '', price: '', stock: '' };

export default function SellerProductManager({ vendorId }: Props) {
  const [products, setProducts] = useState<ProductDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newProduct, setNewProduct] = useState(emptyForm);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState(emptyForm);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function loadProducts() {
    const res = await fetch(`/api/products?vendorId=${encodeURIComponent(vendorId)}`);
    const data = await res.json();
    setProducts(data.products);
  }

  useEffect(() => {
    loadProducts();
  }, []);

  async function handleCreate(event: Event) {
    event.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProduct.name,
          description: newProduct.description,
          priceInCents: toCents(newProduct.price),
          stockQuantity: Number(newProduct.stock),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? 'Could not create product');
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
    });
  }

  async function saveEdit(productId: string) {
    setError(null);
    setSavingId(productId);
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editDraft.name,
          description: editDraft.description,
          priceInCents: toCents(editDraft.price),
          stockQuantity: Number(editDraft.stock),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? 'Could not update product');
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
      const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message ?? 'Could not delete product');
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
            placeholder="Product name"
            value={newProduct.name}
            onInput={(e) =>
              setNewProduct({ ...newProduct, name: (e.target as HTMLInputElement).value })
            }
            class="rounded border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
          />
          <textarea
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
            placeholder="Price (USD)"
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
            placeholder="Stock quantity"
            value={newProduct.stock}
            onInput={(e) =>
              setNewProduct({ ...newProduct, stock: (e.target as HTMLInputElement).value })
            }
            class="rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          class="mt-3 rounded-sm bg-[#fb641b] px-4 py-2 text-xs font-bold tracking-wide text-white uppercase hover:bg-[#e0570f] disabled:opacity-60"
        >
          {creating ? 'Adding…' : 'Add product'}
        </button>
      </form>

      <div class="rounded bg-white shadow-sm">
        <p class="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-500 uppercase">
          Your listings {products ? `(${products.length})` : ''}
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
                      value={editDraft.name}
                      onInput={(e) =>
                        setEditDraft({ ...editDraft, name: (e.target as HTMLInputElement).value })
                      }
                      class="rounded border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
                    />
                    <textarea
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
                      type="number"
                      min="0"
                      step="1"
                      value={editDraft.stock}
                      onInput={(e) =>
                        setEditDraft({ ...editDraft, stock: (e.target as HTMLInputElement).value })
                      }
                      class="rounded border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div class="mt-3 flex gap-3">
                    <button
                      onClick={() => saveEdit(product.id)}
                      disabled={savingId === product.id}
                      class="rounded-sm bg-[#2874f0] px-3 py-1.5 text-xs font-bold text-white uppercase hover:bg-[#1f5bc4] disabled:opacity-60"
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
                  <div>
                    <p class="font-medium text-slate-800">{product.name}</p>
                    <p class="text-sm text-slate-500">
                      {formatMoney(product.priceInCents, product.currency)} ·{' '}
                      <span class={product.stockQuantity > 0 ? 'text-green-600' : 'text-red-500'}>
                        {product.stockQuantity > 0
                          ? `${product.stockQuantity} in stock`
                          : 'Out of stock'}
                      </span>
                    </p>
                  </div>
                  <div class="flex gap-4">
                    <button
                      onClick={() => startEdit(product)}
                      class="text-sm font-semibold text-[#2874f0] uppercase hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteProduct(product.id)}
                      disabled={savingId === product.id}
                      class="text-sm font-semibold text-red-500 uppercase hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
