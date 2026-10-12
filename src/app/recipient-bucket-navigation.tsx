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

export function recipientBucketHref(path: BucketSection, bucket: BucketSelection, query: BucketNavigationData["preservedQuery"]) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {}))
    if (key !== "bucket" && key !== "earlyCareerOnly" && value !== undefined)
      params.set(key, value);
  if (bucket !== "all") params.set("bucket", bucket);
  if (bucket === "peers" && query?.earlyCareerOnly === "true") params.set("earlyCareerOnly", "true");
  const suffix = params.toString();
  return `/${path}${suffix ? `?${suffix}` : ""}`;
}

export function RecipientBucketNavigation({ data, selected, earlyCareerOnly, onSelect }: { data: BucketNavigationData; selected?: BucketSelection; earlyCareerOnly?: boolean; onSelect?: (bucket: BucketSelection, earlyCareerOnly: boolean) => void }) {
  const [pending, setPending] = useState(false);
  const active = selected ?? data.selected;
  const earlyCareer = earlyCareerOnly ?? Boolean(data.earlyCareerOnly);
  const count = (bucket: BucketSelection) => bucket === "all" ? data.total : bucket === "legacy" ? (data.legacyCount ?? 0) : (data.counts[bucket] ?? 0);
  const navigate = (bucket: BucketSelection, nextEarlyCareer = earlyCareer) => {
    if (onSelect) {
      onSelect(bucket, bucket === "peers" && nextEarlyCareer);
      return;
    }
    const query = { ...data.preservedQuery, earlyCareerOnly: bucket === "peers" && nextEarlyCareer ? "true" : undefined };
    setPending(true);
    const href = recipientBucketHref(data.current, bucket, query);
    document.querySelector<HTMLAnchorElement>(`a[data-bucket-href="${CSS.escape(href)}"]`)?.click();
  };
  return (
    <div id="recipient-bucket-navigation" className={styles.navigation} aria-busy={pending}>
      <div className={styles.heading}>
        <strong>Recipient view</strong>
        <span role="status">{pending ? "Updating…" : `${count(active)} shown`}</span>
      </div>
      <nav className={styles.desktop} aria-label="Filter by recipient group">
        <Link onClick={onSelect ? (event) => { event.preventDefault(); navigate("all"); } : undefined} data-bucket-href={recipientBucketHref(data.current, "all", data.preservedQuery)} href={recipientBucketHref(data.current, "all", data.preservedQuery)} aria-current={active === "all" ? "page" : undefined}>All <small>{data.total}</small></Link>
        {recipientBuckets.map((bucket) => (
          <Link onClick={onSelect ? (event) => { event.preventDefault(); navigate(bucket.id); } : undefined} data-bucket-href={recipientBucketHref(data.current, bucket.id, data.preservedQuery)} key={bucket.id} href={recipientBucketHref(data.current, bucket.id, data.preservedQuery)} aria-current={active === bucket.id ? "page" : undefined}>{bucket.label} <small>{data.counts[bucket.id] ?? 0}</small></Link>
        ))}
        {(data.legacyCount ?? 0) > 0 ? <Link onClick={onSelect ? (event) => { event.preventDefault(); navigate("legacy"); } : undefined} data-bucket-href={recipientBucketHref(data.current, "legacy", data.preservedQuery)} href={recipientBucketHref(data.current, "legacy", data.preservedQuery)} aria-current={active === "legacy" ? "page" : undefined}>Legacy <small>{data.legacyCount}</small></Link> : null}
      </nav>
      <label className={styles.mobile}>
        <span>Recipient group</span>
        <select value={active} onChange={(event) => navigate(event.currentTarget.value as BucketSelection)} disabled={pending}>
          <option value="all">All · {data.total}</option>
          {recipientBuckets.map((bucket) => <option key={bucket.id} value={bucket.id}>{bucket.label} · {data.counts[bucket.id] ?? 0}</option>)}
          {(data.legacyCount ?? 0) > 0 ? <option value="legacy">Legacy / unclassified · {data.legacyCount}</option> : null}
        </select>
      </label>
      {active === "peers" ? <label className={styles.earlyCareer}><input type="checkbox" checked={earlyCareer} onChange={(event) => navigate("peers", event.currentTarget.checked)} disabled={pending} /><span>Early-career only</span></label> : null}
    </div>
  );
}
