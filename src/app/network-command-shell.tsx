import Link from "next/link";
import type {ReactNode} from "react";
import styles from "./network-command.module.css";
import {RecipientBucketNavigation,type BucketNavigationData} from "./recipient-bucket-navigation";

type Destination="today"|"drafts"|"sent"|"candidates"|"resumes"|"system";
const destinations:[Destination,string,string][]=[
  ["today","Today","○"],
  ["drafts","Drafts","⌁"],
  ["sent","Sent","✓"],
  ["candidates","Candidates","◇"],
];

export function NetworkCommandShell({current,status,children,bucketNavigation}:{current:Destination;status:string;children:ReactNode;bucketNavigation?:BucketNavigationData}){
  return <main className={styles.shell} data-five-bucket={bucketNavigation?"true":undefined}>
    <a className={styles.skipLink} href="#workspace-content">Skip to workspace</a>
    <header className={styles.commandBar}>
      <Link className={styles.brand} href="/today"><span>N</span><strong>NetworkPilot</strong><em>Command</em></Link>
      <span className={styles.workspaceLabel}>Private outreach workspace</span>
      <span className={styles.health}>{status}</span>
      <div className={styles.supportLinks}><Link aria-current={current==="resumes"?"page":undefined} href="/resumes">Resumes</Link><Link aria-current={current==="system"?"page":undefined} href="/">System</Link></div>
    </header>
    {bucketNavigation?<RecipientBucketNavigation data={bucketNavigation}/>:null}
    {!bucketNavigation?<nav className={styles.rail} aria-label="Primary navigation">
      {destinations.map(([key,label,glyph])=><Link key={key} href={`/${key}`} aria-current={current===key?"page":undefined}><span>{glyph}</span><b>{label}</b></Link>)}
      <div className={styles.railSupport}><Link href="/resumes" aria-current={current==="resumes"?"page":undefined}><span>▤</span><b>Resumes</b></Link><Link href="/" aria-current={current==="system"?"page":undefined}><span>⚙</span><b>System</b></Link></div>
    </nav>:null}
    <section id="workspace-content" tabIndex={-1} className={styles.workspace}>{children}</section>
    <nav className={styles.mobileNav} aria-label="Mobile navigation">
      {destinations.map(([key,label])=><Link key={key} href={`/${key}`} aria-current={current===key?"page":undefined}>{label}</Link>)}
    </nav>
  </main>;
}

export {styles as networkCommandStyles};
