import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it} from "vitest";
import {RecipientBucketNavigation,type BucketNavigationData} from "./recipient-bucket-navigation";

const data:BucketNavigationData={enabled:true,current:"drafts",selected:"peers",counts:{recruiters:2,peers:4,managers:3,executives:1,ceos:1},legacyCount:5,total:16,earlyCareerOnly:true,preservedQuery:{earlyCareerOnly:"true"}};

describe("five-bucket workspace navigation",()=>{
  it("keeps the five buckets plus legacy separate and exposes truthful counts",()=>{
    const html=renderToStaticMarkup(<RecipientBucketNavigation data={data}/>);
    for(const value of ["Recruiters","Peers &amp; practitioners","Managers &amp; team leaders","Executives","CEOs &amp; presidents","Legacy / unclassified"])expect(html).toContain(value);
    expect(html).toContain("bucket=peers&amp;earlyCareerOnly=true");
    expect(html).toContain("bucket=legacy");
    expect(html).toContain('<small>4</small>');
    expect(html).toContain('<small>5</small>');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-label="Select workspace"');
    expect(html).toContain('aria-label="Select recipient bucket"');
  });

  it("preserves the original workspaces in navigation and keeps the early-career filter scoped to peers",()=>{
    const html=renderToStaticMarkup(<RecipientBucketNavigation data={data}/>);
    for(const href of ["/today","/resumes","/","/sent","/candidates"])expect(html).toContain(`href="${href}"`);
    expect(html).toContain("Early-career only");
    expect(html).not.toContain("bucket=recruiters&amp;earlyCareerOnly=true");
  });
});
