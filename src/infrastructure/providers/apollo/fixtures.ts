type FixturePerson={id:string;first_name:string;last_name:string;title:string;seniority:string;city:string;state:string;country:string;email?:string;email_status:string;updated_at:string;organization:{name:string;primary_domain?:string;industry:string};employment_history:Array<{start_date?:string;end_date?:string;current?:boolean}>};
const person=(id:string,title:string,seniority:string,emailStatus:string,years:{start?:string;end?:string;current?:boolean}[],organization="Fictional Apollo Systems"):FixturePerson=>({id,first_name:"Fictional",last_name:`Apollo ${id}`,title,seniority,city:"Boston",state:"Massachusetts",country:"United States",...(emailStatus!=="unavailable"?{email:`fictional.apollo.${id}@example.test`}:{}),email_status:emailStatus,updated_at:"2026-09-08T12:00:00Z",organization:{name:organization,primary_domain:"fictional-apollo.example.test",industry:"technology-ai"},employment_history:years.map((item)=>({start_date:item.start,end_date:item.end,current:item.current}))});
export const APOLLO_PEOPLE={
 manager:person("manager-001","Analytics Manager","manager","verified",[{start:"2017-01-01",current:true}]),
 director:person("director-001","Director of Data Engineering","director","verified",[{start:"2012-01-01",current:true}]),
 senior:person("senior-001","Senior Data Engineer","senior","verified",[{start:"2018-01-01",current:true}]),
 entry:person("entry-001","Entry Level Data Analyst","entry","verified",[{start:"2025-01-01",current:true}]),
 executive:person("executive-001","Chief Data Officer","c_suite","verified",[{start:"2000-01-01",current:true}]),
 vp:person("vp-001","VP Data Analytics","vp","verified",[{start:"2005-01-01",current:true}]),
 ambiguous:person("ambiguous-001","Analyst","senior","verified",[{start:"2018-01-01",current:true}]),
 unknownCompany:person("unknown-001","Data Engineer","senior","verified",[{start:"2018-01-01",current:true}],"Unknown Fictional Company"),
 insufficient:person("insufficient-001","Data Engineer","senior","verified",[{start:"2024-01-01",current:true}]),
 bounded:person("bounded-001","Data Engineer","senior","verified",[{start:"2019-01-01",end:"2025-01-01"}]),
 conflicting:{...person("conflict-001","Data Engineer","senior","verified",[{start:"2022-01-01",end:"2020-01-01"}])},
 unverified:person("unverified-001","Data Engineer","senior","unverified",[{start:"2018-01-01",current:true}]),
 unavailable:person("unavailable-001","Data Engineer","senior","unavailable",[{start:"2018-01-01",current:true}]),
 suppressed:person("suppressed-001","Data Engineer","senior","verified",[{start:"2018-01-01",current:true}]),
} as const;
