import {describe,expect,it} from "vitest";
import {discoveredCompanyIdentity,resolveCompanyTrust} from ".";

describe("company trust resolver",()=>{
  it("defaults provider discoveries to unverified",()=>{
    const companyId=discoveredCompanyIdentity({employerDomain:"ordinary-software.example"})!;
    expect(resolveCompanyTrust({companyId,employerDomain:"ordinary-software.example"})).toMatchObject({state:"unverified",sourceKind:"provider-discovery-default",identityVerified:true});
  });

  it("trusts only an exact authoritative curated ID and domain pair",()=>{
    expect(resolveCompanyTrust({companyId:"microsoft",employerDomain:"microsoft.com"})).toMatchObject({state:"trusted-operating",sourceKind:"authoritative-curated-registry",identityVerified:true});
    expect(resolveCompanyTrust({companyId:"microsoft",employerDomain:null})).toMatchObject({state:"unverified",sourceKind:"identity-unverified",identityVerified:false});
    expect(resolveCompanyTrust({companyId:"microsoft",employerDomain:"microsoft.example"})).toMatchObject({state:"unverified",identityVerified:false});
  });

  it("does not reuse audited trust across different provider IDs, domains, or a same-name identity",()=>{
    const trustedId=discoveredCompanyIdentity({providerEmployerId:"org-one"})!;
    const current={companyId:trustedId,trustState:"trusted-operating" as const,latestAuditEventId:"audit-one",version:1,updatedAt:"2026-09-30T12:00:00.000Z"};
    expect(resolveCompanyTrust({companyId:trustedId,providerEmployerId:"org-one"},current).state).toBe("trusted-operating");
    expect(resolveCompanyTrust({companyId:trustedId,providerEmployerId:"org-two"},current).state).toBe("unverified");
    const domainId=discoveredCompanyIdentity({employerDomain:"one.example"})!;
    expect(resolveCompanyTrust({companyId:domainId,employerDomain:"two.example"},{...current,companyId:domainId}).state).toBe("unverified");
    expect(resolveCompanyTrust({companyId:trustedId},current).state).toBe("unverified");
  });
});
