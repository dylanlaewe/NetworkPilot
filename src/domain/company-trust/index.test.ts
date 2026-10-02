import {describe,expect,it} from "vitest";
import {discoveredCompanyIdentity,resolveCompanyTrust,type CompanyTrustRecord} from ".";

const audited = (
  companyId:string,
  evidence:{providerNamespace?:string|null;providerEmployerId?:string|null;employerDomain?:string|null},
):CompanyTrustRecord=>({
  companyId,
  trustState:"trusted-operating",
  latestAuditEventId:"audit-one",
  version:1,
  updatedAt:"2026-09-30T12:00:00.000Z",
  providerNamespace:evidence.providerNamespace??null,
  providerEmployerId:evidence.providerEmployerId??null,
  reviewedDomain:evidence.employerDomain??null,
});

describe("company trust resolver",()=>{
  it("defaults provider discoveries to unverified",()=>{
    const companyId=discoveredCompanyIdentity({providerNamespace:"apollo",providerEmployerId:"org-one",employerDomain:"ordinary-software.example"})!;
    expect(resolveCompanyTrust({companyId,providerNamespace:"apollo",providerEmployerId:"org-one",employerDomain:"ordinary-software.example"})).toMatchObject({state:"unverified",sourceKind:"provider-discovery-default",identityVerified:true});
  });

  it("trusts only an exact authoritative curated ID and domain pair",()=>{
    expect(resolveCompanyTrust({companyId:"microsoft",employerDomain:"microsoft.com"})).toMatchObject({state:"trusted-operating",sourceKind:"authoritative-curated-registry",identityVerified:true});
    expect(resolveCompanyTrust({companyId:"microsoft",employerDomain:null})).toMatchObject({state:"unverified",sourceKind:"identity-unverified",identityVerified:false});
    expect(resolveCompanyTrust({companyId:"microsoft",employerDomain:"microsoft.example"})).toMatchObject({state:"unverified",identityVerified:false});
  });

  it("uses provider namespace and exact employer ID ahead of corroborating domain",()=>{
    const first=discoveredCompanyIdentity({providerNamespace:"apollo",providerEmployerId:"org-one",employerDomain:"example.com"});
    expect(first).toBe(discoveredCompanyIdentity({providerNamespace:"apollo",providerEmployerId:"org-one",employerDomain:"other.com"}));
    expect(discoveredCompanyIdentity({providerNamespace:"apollo",providerEmployerId:"org-two",employerDomain:"example.com"})).not.toBe(first);
    expect(discoveredCompanyIdentity({providerNamespace:"other",providerEmployerId:"org-one",employerDomain:"example.com"})).not.toBe(first);
    expect(discoveredCompanyIdentity({providerEmployerId:"org-one",employerDomain:"example.com"})).toBeNull();
  });

  it("fails closed when reviewed provider identity evidence drifts",()=>{
    const evidence={providerNamespace:"apollo",providerEmployerId:"org-one",employerDomain:"example.com"},companyId=discoveredCompanyIdentity(evidence)!,current=audited(companyId,evidence);
    expect(resolveCompanyTrust({companyId,...evidence},current).state).toBe("trusted-operating");
    expect(resolveCompanyTrust({companyId,...evidence,employerDomain:"changed.com"},current).state).toBe("unverified");
    expect(resolveCompanyTrust({companyId,...evidence,providerNamespace:"other"},current).state).toBe("unverified");
    expect(resolveCompanyTrust({companyId,...evidence,providerEmployerId:"org-two"},current).state).toBe("unverified");
  });

  it("defines exact-domain fallback without names, fuzzy domains, or parent relationships",()=>{
    const companyId=discoveredCompanyIdentity({employerDomain:"example.com"})!,current=audited(companyId,{employerDomain:"example.com"});
    expect(resolveCompanyTrust({companyId,employerDomain:"example.com"},current).state).toBe("trusted-operating");
    for(const domain of ["examplejobs.com","subsidiary.example.com","other.com"])
      expect(resolveCompanyTrust({companyId,employerDomain:domain},current).state).toBe("unverified");
    expect(discoveredCompanyIdentity({})).toBeNull();
  });
});
