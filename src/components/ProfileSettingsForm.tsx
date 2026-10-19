import { useState } from 'preact/hooks';

interface Props {
  isSeller: boolean;
  initialName: string;
  initialPhone: string;
  initialAddress: string;
  initialCompanyName: string;
  initialCompanyAddress: string;
  initialGstNumber: string;
}

export default function ProfileSettingsForm({
  isSeller,
  initialName,
  initialPhone,
  initialAddress,
  initialCompanyName,
  initialCompanyAddress,
  initialGstNumber,
}: Props) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [address, setAddress] = useState(initialAddress);
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [companyAddress, setCompanyAddress] = useState(initialCompanyAddress);
  const [gstNumber, setGstNumber] = useState(initialGstNumber);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: Event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          address,
          ...(isSeller ? { companyName, companyAddress, gstNumber } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? 'Could not save your profile');
        return;
      }
      setSaved(true);
    } catch {
      setError('Network error — please try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} class="rounded-2xl border border-blue-200 bg-white p-4 sm:p-6">
      {error && <p class="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && (
        <p class="mb-4 rounded bg-green-50 px-3 py-2 text-sm text-green-700">Profile saved.</p>
      )}

      <h2 class="font-heading mb-3 text-sm font-bold text-gray-600 uppercase">Personal details</h2>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="block text-sm sm:col-span-2">
          <span class="mb-1 block font-medium text-slate-600">Full name</span>
          <input
            type="text"
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            class="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label class="block text-sm">
          <span class="mb-1 block font-medium text-slate-600">Phone number</span>
          <input
            type="tel"
            value={phone}
            onInput={(e) => setPhone((e.target as HTMLInputElement).value)}
            class="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label class="block text-sm sm:col-span-2">
          <span class="mb-1 block font-medium text-slate-600">Address</span>
          <textarea
            value={address}
            onInput={(e) => setAddress((e.target as HTMLTextAreaElement).value)}
            rows={3}
            class="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {isSeller && (
        <>
          <h2 class="font-heading mt-6 mb-3 text-sm font-bold text-gray-600 uppercase">
            Business details
          </h2>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label class="block text-sm sm:col-span-2">
              <span class="mb-1 block font-medium text-slate-600">Company name</span>
              <input
                type="text"
                value={companyName}
                onInput={(e) => setCompanyName((e.target as HTMLInputElement).value)}
                class="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label class="block text-sm sm:col-span-2">
              <span class="mb-1 block font-medium text-slate-600">Company address</span>
              <textarea
                value={companyAddress}
                onInput={(e) => setCompanyAddress((e.target as HTMLTextAreaElement).value)}
                rows={3}
                class="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label class="block text-sm sm:col-span-2">
              <span class="mb-1 block font-medium text-slate-600">GST number (optional)</span>
              <input
                type="text"
                value={gstNumber}
                onInput={(e) => setGstNumber((e.target as HTMLInputElement).value)}
                placeholder="e.g. 22AAAAA0000A1Z5"
                class="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        </>
      )}

      <button
        type="submit"
        disabled={saving}
        class="bg-brand hover:bg-brand-dark mt-6 rounded-full px-6 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}
