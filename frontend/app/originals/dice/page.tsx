'use client';

import { useState } from 'react';

type DemoRound = {
  roundReference: string;
  outcome: { roll: number; target: number; direction: 'over' | 'under'; result: 'win' | 'loss'; multiplier: number };
  notice: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function VeltDiceDemoPage() {
  const [round, setRound] = useState<DemoRound | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [target, setTarget] = useState(50);
  const [direction, setDirection] = useState<'over' | 'under'>('over');

  const rollDice = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/originals/dice/demo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target, direction }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to roll the dice');
      setRound(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Practice game unavailable');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <p className="text-sm uppercase tracking-[0.3em] text-amber-400">VELT Originals · Practice</p>
        <h1 className="mt-3 text-5xl font-bold">Dice</h1>
        <p className="mt-4 text-slate-300">Choose over or under a target from 0.01 to 99.99. Outcomes and round history are generated on the server.</p>

        <section className="mt-10 rounded-3xl border border-slate-700 bg-slate-900 p-8 text-center">
          <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-3xl bg-white text-7xl font-black text-slate-950 shadow-2xl" aria-live="polite">
            {loading ? '…' : round?.outcome.diceValue ?? '—'}
          </div>
          {round && (
            <div className="mt-6">
              <p className="text-2xl font-semibold capitalize">{round.outcome.result} · {round.outcome.multiplier}x</p>
              <p className="mt-2 break-all text-xs text-slate-500">Round {round.roundReference}</p>
            </div>
          )}
          <div className="mt-6 flex justify-center gap-3">
            <label className="text-sm text-slate-300">Target <input type="number" min="0.01" max="99.99" step="0.01" value={target} onChange={e => setTarget(Number(e.target.value))} className="ml-2 w-24 rounded-lg bg-slate-800 px-3 py-2" /></label>
            <label className="text-sm text-slate-300">Direction <select value={direction} onChange={e => setDirection(e.target.value as 'over' | 'under')} className="ml-2 rounded-lg bg-slate-800 px-3 py-2"><option value="over">Over</option><option value="under">Under</option></select></label>
          </div>
          <button onClick={rollDice} disabled={loading} className="mt-8 rounded-xl bg-amber-400 px-8 py-4 font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? 'Rolling…' : 'Roll dice'}
          </button>
          {error && <p className="mt-4 text-sm text-red-400" role="alert">{error}</p>}
        </section>

        <p className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          Practice mode only. No stake is accepted, no wallet is accessed and no prize is paid. This implementation is not certified for real-money gaming.
        </p>
      </div>
    </main>
  );
}
