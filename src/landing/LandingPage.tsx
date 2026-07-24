import { useState } from 'react';

export function LandingPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: wire up to Supabase waitlist table. For now, just log it.
    console.log('Waitlist signup:', email);
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen w-screen bg-gray-900 text-white flex flex-col items-center justify-center overflow-hidden px-6">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />

      <main className="relative z-10 flex flex-col items-center text-center max-w-2xl">
        <span className="mb-6 rounded-full border border-gray-700 bg-gray-800/60 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-gray-300">
          Coming soon
        </span>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
          Run the subway.
          <br />
          <span className="bg-gradient-to-r from-blue-400 to-green-400 bg-clip-text text-transparent">
            Powered by your body.
          </span>
        </h1>

        <p className="mt-6 max-w-xl text-lg text-gray-400">
          A first-person cardio runner controlled entirely by your webcam. Jump,
          duck, and dodge in real life to dodge obstacles on screen. No controller —
          just you.
        </p>

        {/* Waitlist form */}
        {submitted ? (
          <div className="mt-10 rounded-xl border border-green-500/40 bg-green-500/10 px-6 py-4 text-green-300">
            🎉 You're on the list! We'll email you when it's ready.
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-10 flex w-full max-w-md flex-col gap-3 sm:flex-row"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="flex-1 rounded-lg border border-gray-700 bg-gray-800/80 px-4 py-3 text-white placeholder-gray-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            />
            <button
              type="submit"
              className="rounded-lg bg-gradient-to-r from-blue-500 to-green-500 px-6 py-3 font-semibold text-white transition hover:opacity-90 active:scale-95"
            >
              Join waitlist
            </button>
          </form>
        )}

        <p className="mt-4 text-xs text-gray-600">
          No spam. Just one email when we launch.
        </p>

        {/* Quiet path into the live demo — keeps the game reachable */}
        <a
          href="#play"
          className="mt-12 text-sm text-gray-500 underline-offset-4 transition hover:text-gray-300 hover:underline"
        >
          Try the live demo →
        </a>
      </main>
    </div>
  );
}
