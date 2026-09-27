import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it} from "vitest";
import {CandidateRefreshControl} from "./refresh-control";

describe("bucket-scoped Find more control",()=>{
  it("shows the selected bucket, peer scope, and stable request token in its confirmation form",()=>{
    const html=renderToStaticMarkup(<CandidateRefreshControl available={0} totalReserve={2} fiveBucketEnabled bucket="peers" earlyCareerOnly requestId="fixture-request-id"/>);
    expect(html).toContain("Find more peers");
    expect(html).toContain("Early-career peers only");
    expect(html).toContain('name="bucket" value="peers"');
    expect(html).toContain('name="earlyCareerOnly" value="true"');
    expect(html).toContain('name="requestId" value="fixture-request-id"');
    expect(html).toContain('name="requested" value="20"');
    expect(html).toContain("shared allowance");
  });

  it("keeps legacy records non-actionable",()=>{
    const html=renderToStaticMarkup(<CandidateRefreshControl available={0} fiveBucketEnabled legacyView/>);
    expect(html).toContain("not actionable");
    expect(html).not.toContain("Find more candidates");
  });

  it("shows the actual configured authorization ceiling after shared daily usage",()=>{
    const html=renderToStaticMarkup(<CandidateRefreshControl available={0} exposure={7} maximumPerBatch={5} maximumPerDay={10} fiveBucketEnabled bucket="recruiters" requestId="fixture-request-id"/>);
    expect(html).toContain("Maximum credits");
    expect(html).toContain("<dd>3</dd>");
  });
  it("submits the same bounded maximum shown to the operator",()=>{
    const html=renderToStaticMarkup(<CandidateRefreshControl available={39} maximumPerBatch={5} maximumPerDay={10} fiveBucketEnabled bucket="peers" requestId="fixture-request-id"/>);
    expect(html).toContain("<dt>Maximum credits</dt><dd>1</dd>");
    expect(html).toContain('name="requested" value="1"');
  });
});
