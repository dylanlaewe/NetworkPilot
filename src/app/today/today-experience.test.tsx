import {readFileSync} from "node:fs";
import {join} from "node:path";
import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it} from "vitest";
import {DemoToday} from "./demo-today";
import {GmailSendControl} from "./gmail-send-control";

describe("Today product experience",()=>{
  it("renders an unmistakable synthetic demo workspace without loading production identities",()=>{const html=renderToStaticMarkup(<DemoToday/>);expect(html).toContain("Demo Mode");expect(html).toContain("Alex Morgan");expect(html).toContain("No live providers or real contacts are loaded");expect(html).not.toMatch(/Dylan|Bresco|@gmail\.com/i);});
  it("keeps the complete demo workflow client-side and simulated",()=>{const source=readFileSync(join(process.cwd(),"src/app/today/demo-today.tsx"),"utf8");for(const label of ["Refresh Today’s Pipeline","Approve Draft","Create Mock Gmail Draft","Simulate Send","Record Sample Reply"])expect(source).toContain(label);expect(source).not.toMatch(/sendGmailDraft|createCommandCenterGmailDraft|ApolloAdapter|GmailDraftAdapter/);});
  it("uses focused review navigation and responsive layouts without page-level horizontal overflow",()=>{const page=readFileSync(join(process.cwd(),"src/app/drafts/page.tsx"),"utf8"),styles=readFileSync(join(process.cwd(),"src/app/globals.css"),"utf8");expect(page).toContain("/drafts/review?candidate=");expect(styles).toContain("@media(max-width:760px)");expect(styles).toContain(".draft-table-row{grid-template-columns:1fr auto");expect(styles).not.toMatch(/body\s*\{[^}]*overflow-x:\s*(auto|scroll)/);});
  it("shows the real-send confirmation context and an enabled explicit final submit",()=>{const html=renderToStaticMarkup(<GmailSendControl snapshotId="fixture" recipient="A*** R." company="Fictional Co" subject="A fixture subject" track="professional" action={async()=>{}}/>);expect(html).toContain("Send this email now?");expect(html).toContain("A*** R.");expect(html).toContain("Fictional Co");expect(html).toContain("A fixture subject");expect(html).toContain("professional");expect(html).toContain("contacts the recipient immediately");expect(html).toContain('name="confirmation"');expect(html).toContain('value="send-approved-draft-now"');expect(html).not.toContain("disabled");});
  it("preserves operator-safe send failures and unexpected errors",()=>{const actions=readFileSync(join(process.cwd(),"src/app/today/actions.ts"),"utf8"),drafts=readFileSync(join(process.cwd(),"src/app/drafts/page.tsx"),"utf8");expect(actions).toContain("operatorSafeSendErrors.has(code)");expect(actions).toContain("sendError=");expect(actions).toContain("throw error");expect(drafts).toContain("humanSendError(sendBlock)");});
});
