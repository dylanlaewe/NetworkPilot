import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it} from "vitest";
import {GmailSendControl} from "./gmail-send-control";

describe("Gmail send confirmation",()=>{
  it("states that the approved draft will contact the recipient immediately",()=>{const html=renderToStaticMarkup(<GmailSendControl snapshotId="fixture" recipient="A*** R." company="Fictional Co" subject="A question" track="professional" action={()=>{}}/>);expect(html).toContain("Send this email now?");expect(html).toContain("contacts the recipient immediately");expect(html).toContain("A*** R.");expect(html).toContain("Fictional Co");expect(html).toContain("A question");expect(html).toContain('name="confirmation"');expect(html).toContain('value="send-approved-draft-now"');});
  it("keeps Cancel non-submitting and exposes a keyboard-operable disclosure",()=>{const html=renderToStaticMarkup(<GmailSendControl snapshotId="fixture" recipient="A*** R." company="Fictional Co" subject="A question" track="recruiter" action={()=>{}}/>);expect(html).toContain("<summary>Send Email</summary>");expect(html).toContain('<button type="button">Cancel</button>');expect(html).toContain('role="alertdialog"');});
});
