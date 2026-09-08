"use client";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="state-page"><span className="mode-pill"><b/> Simulation mode</span><h1>Simulation data is unavailable.</h1><p>No action was sent. Check the local database setup, then try again.</p><button className="simulate-button" onClick={reset}>Retry simulation dashboard</button></main>;
}
