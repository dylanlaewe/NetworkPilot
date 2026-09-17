import Link from "next/link";

const primary = [
  ["Today", "/today"],
  ["Drafts", "/drafts"],
  ["Sent", "/sent"],
  ["Candidates", "/candidates"],
] as const;

export function ProductNav({current}:{current:"today"|"drafts"|"sent"|"candidates"|"system"}) {
  return <nav className="nav product-nav" aria-label="Primary navigation">
    <Link className="brand" href="/today"><span className="brand-mark"><i/><i/><i/></span>Network<span>Pilot</span></Link>
    <div className="nav-meta">
      {primary.map(([label,href])=><Link key={href} href={href} aria-current={current===label.toLowerCase()?"page":undefined}>{label}</Link>)}
      <Link className="secondary-nav" href="/" aria-current={current==="system"?"page":undefined}>System</Link>
    </div>
  </nav>;
}
