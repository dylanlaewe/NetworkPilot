import Link from "next/link";
import type {ReactNode} from "react";
import styles from "./network-command.module.css";

type Destination="today"|"drafts"|"sent"|"candidates";
const destinations:[Destination,string,string][]=[
  ["today","Today","○"],
  ["drafts","Drafts","⌁"],
  ["sent","Sent","✓"],
  ["candidates","Candidates","◇"],
];

export function NetworkCommandShell({current,status,children}:{current:Destination;status:string;children:ReactNode}){
  return <main className={styles.shell}>
    <a className={styles.skipLink} href="#workspace-content">Skip to workspace</a>
    <header className={styles.commandBar}>
      <Link className={styles.brand} href="/today"><span>N</span><strong>NetworkPilot</strong><em>Command</em></Link>
      <span className={styles.workspaceLabel}>Private outreach workspace</span>
      <span className={styles.health}>{status}</span>
      <Link className={styles.supportLink} href="/">System</Link>
    </header>
    <nav className={styles.rail} aria-label="Primary navigation">
      {destinations.map(([key,label,glyph])=><Link key={key} href={`/${key}`} aria-current={current===key?"page":undefined}><span>{glyph}</span><b>{label}</b></Link>)}
    </nav>
    <section id="workspace-content" tabIndex={-1} className={styles.workspace}>{children}</section>
    <nav className={styles.mobileNav} aria-label="Mobile navigation">
      {destinations.map(([key,label])=><Link key={key} href={`/${key}`} aria-current={current===key?"page":undefined}>{label}</Link>)}
    </nav>
  </main>;
}

export {styles as networkCommandStyles};
