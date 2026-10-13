import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it} from "vitest";
import {CandidateRefreshControl} from "./refresh-control";

describe("bucket-scoped Find people control",()=>{
  it("shows the selected bucket, peer scope, and stable request token in its confirmation form",()=>{
    const html=renderToStaticMarkup(<CandidateRefreshControl available={0} totalReserve={2} fiveBucketEnabled bucket="peers" earlyCareerOnly requestId="fixture-request-id"/>);
    expect(html).toContain("Find people");
    expect(html).toContain("Find peers");
    expect(html).toContain("Early-career peers only");
    expect(html).toContain('name="bucket" value="peers"');
    expect(html).toContain('name="earlyCareerOnly" value="true"');
    expect(html).toContain('name="requestId" value="fixture-request-id"');
    expect(html).toContain('name="requested" value="20"');
    expect(html).toContain("may use Apollo credits");
  });

  it("keeps legacy records non-actionable",()=>{
    const html=renderToStaticMarkup(<CandidateRefreshControl available={0} fiveBucketEnabled legacyView/>);
    expect(html).toContain("Legacy records stay unchanged");
    expect(html).not.toContain("<form");
  });

  it("shows the actual configured authorization ceiling after shared daily usage",()=>{
    const html=renderToStaticMarkup(<CandidateRefreshControl available={0} exposure={7} maximumPerBatch={5} maximumPerDay={10} fiveBucketEnabled bucket="recruiters" requestId="fixture-request-id"/>);
    expect(html).toContain("Maximum Apollo credits");
    expect(html).toContain("<dd>3</dd>");
  });
  it("submits the same bounded maximum shown to the operator",()=>{
    const html=renderToStaticMarkup(<CandidateRefreshControl available={39} maximumPerBatch={5} maximumPerDay={10} fiveBucketEnabled bucket="peers" requestId="fixture-request-id"/>);
    expect(html).toContain("<dt>Maximum Apollo credits</dt><dd>1</dd>");
    expect(html).toContain('name="requested" value="1"');
  });
  it("renders a human readiness reason and no confirmation form when blocked",()=>{
    const html=renderToStaticMarkup(<CandidateRefreshControl available={0} fiveBucketEnabled bucket="recruiters" requestId="fixture-request-id" readiness={{ready:false,reason:"recruiter-evidence-store-unavailable",technicalDetail:"fixture raw detail"}}/>);
    expect(html).toContain("Find people is unavailable");
    expect(html).toContain("Recruiter evidence store is unavailable");
    expect(html).not.toContain("fixture raw detail");
    expect(html).not.toContain("<form");
  });
});
