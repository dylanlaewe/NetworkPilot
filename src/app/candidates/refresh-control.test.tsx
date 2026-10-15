import {renderToStaticMarkup} from "react-dom/server";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {describe,expect,it} from "vitest";
import {CandidateRefreshControl} from "./refresh-control";

describe("bucket-scoped Find people control",()=>{
  it("moves focus into an opened panel and supports document-level Escape with focus return",()=>{
    const source=readFileSync(join(process.cwd(),"src/app/candidates/refresh-control.tsx"),"utf8");
    expect(source).toContain("requestAnimationFrame");
    expect(source).toContain("panelRef.current");
    expect(source).toContain("document.addEventListener(\"keydown\", onKeyDown)");
    expect(source).toContain('event.key !== "Escape"');
    expect(source).toContain("triggerRef.current?.focus()");
  });
  it("shows the selected bucket, peer scope, and stable request token in its confirmation form",()=>{
    const html=renderToStaticMarkup(<CandidateRefreshControl available={0} totalReserve={2} fiveBucketEnabled bucket="peers" earlyCareerOnly requestId="fixture-request-id"/>);
    expect(html).toContain("Find people");
    expect(html).toContain("Peers &amp; practitioners");
    expect(html).toContain("Early-career peers only");
    expect(html).toContain('name="bucket" value="peers"');
    expect(html).toContain('name="earlyCareerOnly" value="true"');
    expect(html).toContain('name="requestId" value="fixture-request-id"');
    expect(html).toContain('name="requested" value="5"');
    expect(html).toContain("may use Apollo");
    expect(html).toContain("target, not a guaranteed yield");
  });

  it("keeps legacy records non-actionable",()=>{
    const html=renderToStaticMarkup(<CandidateRefreshControl available={0} fiveBucketEnabled legacyView/>);
    expect(html).toContain("Legacy records stay unchanged");
    expect(html).not.toContain("<form");
  });

  it("shows the actual configured authorization ceiling after shared daily usage",()=>{
    const html=renderToStaticMarkup(<CandidateRefreshControl available={0} exposure={7} maximumPerBatch={5} maximumPerDay={10} fiveBucketEnabled bucket="recruiters" requestId="fixture-request-id"/>);
    expect(html).toContain("Maximum credits this run");
    expect(html).toContain("<dd>3</dd>");
  });
  it("keeps the desired result target distinct from the authorization ceiling",()=>{
    const html=renderToStaticMarkup(<CandidateRefreshControl available={39} maximumPerBatch={5} maximumPerDay={10} fiveBucketEnabled bucket="peers" requestId="fixture-request-id"/>);
    expect(html).toContain("<dt>Maximum credits this run</dt><dd>5</dd>");
    expect(html).toContain('name="requested" value="5"');
  });
  it("distinguishes local allowance exhaustion from provider balance",()=>{
    const html=renderToStaticMarkup(<CandidateRefreshControl available={0} exposure={10} maximumPerDay={10} fiveBucketEnabled bucket="ceos" requestId="fixture-request-id"/>);
    expect(html).toContain("local daily allowance is fully accounted or held");
    expect(html).toContain("separate from the Apollo account balance");
    expect(html).not.toContain("<form");
  });
  it("renders a human readiness reason and no confirmation form when blocked",()=>{
    const html=renderToStaticMarkup(<CandidateRefreshControl available={0} fiveBucketEnabled bucket="recruiters" requestId="fixture-request-id" readiness={{ready:false,reason:"recruiter-evidence-store-unavailable",technicalDetail:"fixture raw detail"}}/>);
    expect(html).toContain("Find people is unavailable");
    expect(html).toContain("Recruiter evidence store is unavailable");
    expect(html).not.toContain("fixture raw detail");
    expect(html).not.toContain("<form");
  });
});
