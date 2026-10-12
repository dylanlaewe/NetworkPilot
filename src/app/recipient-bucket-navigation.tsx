"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./recipient-bucket-navigation.module.css";

export const recipientBuckets = [
  { id: "recruiters", label: "Recruiters" },
  { id: "peers", label: "Peers & practitioners" },
  { id: "managers", label: "Managers & team leaders" },
  { id: "executives", label: "Executives" },
  { id: "ceos", label: "CEOs & presidents" },
] as const;
export type RecipientBucket = (typeof recipientBuckets)[number]["id"];
export type BucketSelection = "all" | "legacy" | RecipientBucket;
export type BucketSection = "drafts" | "sent" | "candidates";
export type RecipientBucketCounts = Partial<Record<RecipientBucket, number>>;

export interface BucketNavigationData {
  enabled: true;
  current: BucketSection;
  selected: BucketSelection;
  counts: RecipientBucketCounts;
  legacyCount?: number;
  earlyCareerOnly?: boolean;
  total: number;
  preservedQuery?: Record<string, string | undefined>;
}

function withBucket(path: BucketSection, bucket: BucketSelection, query: BucketNavigationData["preservedQuery"]) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {}))
    if (key !== "bucket" && key !== "earlyCareerOnly" && value !== undefined)
      params.set(key, value);
  if (bucket !== "all") params.set("bucket", bucket);
  if (bucket === "peers" && query?.earlyCareerOnly === "true") params.set("earlyCareerOnly", "true");
  const suffix = params.toString();
  return `/${path}${suffix ? `?${suffix}` : ""}`;
}

export function RecipientBucketNavigation({ data }: { data: BucketNavigationData }) {
  const [pending, setPending] = useState(false);
  const count = (bucket: BucketSelection) => bucket === "all" ? data.total : bucket === "legacy" ? (data.legacyCount ?? 0) : (data.counts[bucket] ?? 0);
  const navigate = (bucket: BucketSelection, earlyCareerOnly = data.earlyCareerOnly) => {
    const query = { ...data.preservedQuery, earlyCareerOnly: bucket === "peers" && earlyCareerOnly ? "true" : undefined };
    setPending(true);
    const href = withBucket(data.current, bucket, query);
    document.querySelector<HTMLAnchorElement>(`a[data-bucket-href="${CSS.escape(href)}"]`)?.click();
  };
  return (
    <div className={styles.navigation} aria-busy={pending}>
      <div className={styles.heading}>
        <strong>Recipient view</strong>
        <span role="status">{pending ? "Updating…" : `${count(data.selected)} shown`}</span>
      </div>
      <nav className={styles.desktop} aria-label="Filter by recipient group">
        <Link data-bucket-href={withBucket(data.current, "all", data.preservedQuery)} href={withBucket(data.current, "all", data.preservedQuery)} aria-current={data.selected === "all" ? "page" : undefined}>All <small>{data.total}</small></Link>
        {recipientBuckets.map((bucket) => (
          <Link data-bucket-href={withBucket(data.current, bucket.id, data.preservedQuery)} key={bucket.id} href={withBucket(data.current, bucket.id, data.preservedQuery)} aria-current={data.selected === bucket.id ? "page" : undefined}>{bucket.label} <small>{data.counts[bucket.id] ?? 0}</small></Link>
        ))}
        {(data.legacyCount ?? 0) > 0 ? <Link data-bucket-href={withBucket(data.current, "legacy", data.preservedQuery)} href={withBucket(data.current, "legacy", data.preservedQuery)} aria-current={data.selected === "legacy" ? "page" : undefined}>Legacy <small>{data.legacyCount}</small></Link> : null}
      </nav>
      <label className={styles.mobile}>
        <span>Recipient group</span>
        <select value={data.selected} onChange={(event) => navigate(event.currentTarget.value as BucketSelection)} disabled={pending}>
          <option value="all">All · {data.total}</option>
          {recipientBuckets.map((bucket) => <option key={bucket.id} value={bucket.id}>{bucket.label} · {data.counts[bucket.id] ?? 0}</option>)}
          {(data.legacyCount ?? 0) > 0 ? <option value="legacy">Legacy / unclassified · {data.legacyCount}</option> : null}
        </select>
      </label>
      {data.selected === "peers" ? <label className={styles.earlyCareer}><input type="checkbox" checked={Boolean(data.earlyCareerOnly)} onChange={(event) => navigate("peers", event.currentTarget.checked)} disabled={pending} /><span>Early-career only</span></label> : null}
    </div>
  );
}
