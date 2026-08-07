import { useState } from 'preact/hooks';

export default function RegisterForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: Event) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? 'Registration failed');
        return;
      }
      window.location.assign(role === 'seller' ? '/sell' : '/');
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} class="mx-auto mt-10 max-w-sm rounded bg-white p-6 shadow-sm">
      <h1 class="mb-4 text-xl font-bold text-slate-800">Create account</h1>
      {error && <p class="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <label class="mb-3 block text-sm">
        <span class="mb-1 block font-medium text-slate-600">Email</span>
        <input
          type="email"
          required
          value={email}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
          class="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      <label class="mb-3 block text-sm">
        <span class="mb-1 block font-medium text-slate-600">Password</span>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
          class="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <span class="mt-1 block text-xs text-slate-400">At least 8 characters</span>
      </label>

      <fieldset class="mb-4">
        <legend class="mb-1 text-sm font-medium text-slate-600">I want to</legend>
        <div class="flex gap-4 text-sm text-slate-700">
          <label class="flex items-center gap-2">
            <input
              type="radio"
              name="role"
              checked={role === 'buyer'}
              onChange={() => setRole('buyer')}
            />
            Shop (buyer)
          </label>
          <label class="flex items-center gap-2">
            <input
              type="radio"
              name="role"
              checked={role === 'seller'}
              onChange={() => setRole('seller')}
            />
            Sell products (seller)
          </label>
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={loading}
        class="w-full rounded-sm bg-[#fb641b] px-4 py-2 text-sm font-bold tracking-wide text-white uppercase hover:bg-[#e0570f] disabled:opacity-60"
      >
        {loading ? 'Creating…' : 'Create account'}
      </button>

      <p class="mt-4 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <a href="/login" class="font-medium text-[#2874f0] hover:underline">
          Login
        </a>
      </p>
    </form>
  );
}
