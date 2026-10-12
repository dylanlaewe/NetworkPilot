import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./network-command.module.css";
import { RecipientBucketNavigation, type BucketNavigationData } from "./recipient-bucket-navigation";

export type NetworkDestination = "today" | "drafts" | "sent" | "candidates" | "resumes" | "system";
type IconName = NetworkDestination;

const primaryDestinations = [
  { id: "today", label: "Today" },
  { id: "drafts", label: "Drafts" },
  { id: "candidates", label: "Candidates" },
  { id: "sent", label: "Sent" },
] as const;
const secondaryDestinations = [
  { id: "resumes", label: "Resumes" },
  { id: "system", label: "Settings" },
] as const;

export function NetworkIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    today: <><path d="M4 5.5h16M7 3v5M17 3v5M5 9.5h14v10H5z" /><path d="M8 13h3M8 16h6" /></>,
    drafts: <><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    candidates: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.5-4 2.3-6 5.5-6s5 2 5.5 6M16 8h5M18.5 5.5v5" /></>,
    sent: <><path d="m3 11 18-7-6.5 16-3.2-6.7z" /><path d="M11.3 13.3 21 4" /></>,
    resumes: <><path d="M6 3h9l3 3v15H6z" /><path d="M15 3v4h4M9 11h6M9 15h6" /></>,
    system: <><circle cx="12" cy="12" r="3" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /></>,
  };
  return <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export function NetworkNavigation({ current, status }: { current: NetworkDestination; status: string }) {
  return <>
    <aside className={styles.sidebar} aria-label="NetworkPilot navigation">
      <Link className={styles.brand} href="/today"><span className={styles.brandMark} aria-hidden="true"><i /><i /></span><strong>NetworkPilot</strong></Link>
      <nav className={styles.primaryNav} aria-label="Primary navigation">
        {primaryDestinations.map(({ id, label }) => <Link key={id} href={`/${id}`} aria-current={current === id ? "page" : undefined}><NetworkIcon name={id} /><span>{label}</span></Link>)}
      </nav>
      <nav className={styles.secondaryNav} aria-label="Supporting navigation">
        {secondaryDestinations.map(({ id, label }) => <Link key={id} href={id === "system" ? "/" : `/${id}`} aria-current={current === id ? "page" : undefined}><NetworkIcon name={id} /><span>{label}</span></Link>)}
      </nav>
      <div className={styles.profile} title={status}><span className={styles.profileMark} aria-hidden="true">D</span><span><strong>Dylan</strong><small>{status}</small></span></div>
    </aside>
    <header className={styles.mobileHeader}>
      <Link className={styles.brand} href="/today"><span className={styles.brandMark} aria-hidden="true"><i /><i /></span><strong>NetworkPilot</strong></Link>
      <Link href="/" aria-label="Open settings"><NetworkIcon name="system" /></Link>
    </header>
    <nav className={styles.mobileNav} aria-label="Primary navigation">
      {primaryDestinations.map(({ id, label }) => <Link key={id} href={`/${id}`} aria-current={current === id ? "page" : undefined}><NetworkIcon name={id} /><span>{label}</span></Link>)}
    </nav>
  </>;
}

export function NetworkCommandShell({ current, status, children, bucketNavigation }: { current: NetworkDestination; status: string; children: ReactNode; bucketNavigation?: BucketNavigationData }) {
  return <main className={styles.shell} data-five-bucket={bucketNavigation ? "true" : undefined}>
    <a className={styles.skipLink} href="#workspace-content">Skip to workspace</a>
    <NetworkNavigation current={current} status={status} />
    <section id="workspace-content" tabIndex={-1} className={styles.workspace}>{bucketNavigation ? <RecipientBucketNavigation data={bucketNavigation} /> : null}{children}</section>
  </main>;
}

export { styles as networkCommandStyles };
