"use client";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="state-page"><span className="mode-pill"><b/> No email sending</span><h1>NetworkPilot could not complete that local action.</h1><p>No email was sent. Check the readiness details on Today, then try again. Provider credentials and internal errors are never displayed here.</p><button className="simulate-button" onClick={reset}>Return to the dashboard</button></main>;
}
