import {readFileSync} from "node:fs";
import {join} from "node:path";
import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it} from "vitest";
import {DemoToday} from "./demo-today";

describe("Today product experience",()=>{
  it("renders an unmistakable synthetic demo workspace without loading production identities",()=>{const html=renderToStaticMarkup(<DemoToday/>);expect(html).toContain("Demo Mode");expect(html).toContain("Alex Morgan");expect(html).toContain("No live providers or real contacts are loaded");expect(html).not.toMatch(/Dylan|Bresco|@gmail\.com/i);});
  it("keeps the complete demo workflow client-side and simulated",()=>{const source=readFileSync(join(process.cwd(),"src/app/today/demo-today.tsx"),"utf8");for(const label of ["Refresh Today’s Pipeline","Approve Draft","Create Mock Gmail Draft","Simulate Send","Record Sample Reply"])expect(source).toContain(label);expect(source).not.toMatch(/sendGmailDraft|createCommandCenterGmailDraft|ApolloAdapter|GmailDraftAdapter/);});
  it("uses progressive disclosure and responsive layouts without page-level horizontal overflow",()=>{const page=readFileSync(join(process.cwd(),"src/app/today/page.tsx"),"utf8"),styles=readFileSync(join(process.cwd(),"src/app/globals.css"),"utf8");expect(page).toContain("<details><summary>Review message</summary>");expect(styles).toContain("@media(max-width:760px)");expect(styles).toContain(".reserve-grid article{grid-template-columns:1fr}");expect(styles).not.toMatch(/body\s*\{[^}]*overflow-x:\s*(auto|scroll)/);});
});
