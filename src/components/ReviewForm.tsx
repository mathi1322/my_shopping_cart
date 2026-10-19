import { useState } from 'preact/hooks';
import { fetchJson } from '../lib/ui/fetchJson';

interface Props {
  productId: string;
}

const RATING_LABELS = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

export default function ReviewForm({ productId }: Props) {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: Event) {
    event.preventDefault();
    if (rating === null) {
      setError('Choose a rating from 1 to 5 stars');
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await fetchJson(`/api/products/${productId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, comment }),
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    // Reload so the new review, the updated average and the "already reviewed" state all show.
    window.location.reload();
  }

  return (
    <form onSubmit={handleSubmit} class="rounded-xl border border-slate-200 p-4">
      <h3 class="font-heading mb-3 text-base font-semibold text-slate-800">Write a review</h3>

      <fieldset class="mb-3">
        <legend class="mb-1 text-sm font-medium text-slate-600">Your rating</legend>
        <div class="flex gap-1">
          {RATING_LABELS.map((label, index) => {
            const value = index + 1;
            const filled = rating !== null && value <= rating;
            return (
              <label
                key={value}
                class={`cursor-pointer text-2xl leading-none ${filled ? 'text-amber-600' : 'text-slate-400'} has-focus-visible:outline-brand rounded has-focus-visible:outline-2`}
              >
                <input
                  type="radio"
                  name="rating"
                  value={value}
                  checked={rating === value}
                  onChange={() => setRating(value)}
                  class="sr-only"
                  aria-label={`${value} star${value === 1 ? '' : 's'} — ${label}`}
                />
                <span aria-hidden="true">{filled ? '★' : '☆'}</span>
              </label>
            );
          })}
        </div>
        {rating !== null && <p class="mt-1 text-xs text-slate-500">{RATING_LABELS[rating - 1]}</p>}
      </fieldset>

      <label class="mb-3 block text-sm">
        <span class="mb-1 block font-medium text-slate-600">Your review (optional)</span>
        <textarea
          value={comment}
          onInput={(event) => setComment((event.target as HTMLTextAreaElement).value)}
          maxLength={2000}
          rows={3}
          class="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      {error && (
        <p role="alert" class="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        class="bg-brand hover:bg-brand-dark rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {submitting ? 'Submitting…' : 'Submit review'}
      </button>
    </form>
  );
}
