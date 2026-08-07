import { useState } from 'preact/hooks';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: Event) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? 'Login failed');
        return;
      }
      window.location.assign('/');
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} class="mx-auto mt-10 max-w-sm rounded bg-white p-6 shadow-sm">
      <h1 class="mb-4 text-xl font-bold text-slate-800">Login</h1>
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

      <label class="mb-4 block text-sm">
        <span class="mb-1 block font-medium text-slate-600">Password</span>
        <input
          type="password"
          required
          value={password}
          onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
          class="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        class="w-full rounded-sm bg-[#2874f0] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1f5bc4] disabled:opacity-60"
      >
        {loading ? 'Logging in…' : 'Login'}
      </button>

      <p class="mt-4 text-center text-sm text-slate-500">
        New here?{' '}
        <a href="/register" class="font-medium text-[#2874f0] hover:underline">
          Create an account
        </a>
      </p>
    </form>
  );
}
