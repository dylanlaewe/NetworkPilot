"use client";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="state-page"><h1>That action could not be completed.</h1><p>Your current work is unchanged. Return to the page and try again, or check System if the problem continues.</p><button className="simulate-button" onClick={reset}>Try again</button></main>;
}
