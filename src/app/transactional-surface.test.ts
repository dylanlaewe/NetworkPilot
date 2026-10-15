import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("shared transactional component craft", () => {
  it("keeps common type, control, focus, pending, and reduced-motion treatment", () => {
    const css = read("src/app/transactional-surface.module.css");
    expect(css).toContain("font-size: 20px");
    expect(css).toContain("min-height: 44px");
    expect(css).toContain("outline: 3px solid var(--transaction-focus)");
    expect(css).toContain("min-width: 112px");
    expect(css).toContain("@container (max-width: 520px)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("gives dialogs and compact layers safe keyboard dismissal and focus return", () => {
    const behavior = read("src/app/use-transactional-surface.ts");
    const candidates = read("src/app/candidates/candidates-workspace.tsx");
    const drafts = read("src/app/drafts/drafts-workspace.tsx");
    expect(behavior).toContain('event.key === "Escape"');
    expect(behavior).toContain("returnFocus?.current");
    expect(behavior).toContain("last.focus()");
    expect(behavior).toContain("requestAnimationFrame(() => summary?.focus())");
    expect(candidates).toContain("useDismissibleLayer<HTMLDivElement>");
    expect(drafts).toContain("useDismissibleLayer<HTMLDivElement>");
    expect(drafts).toContain("closeDetailsOnEscape");
  });

  it("uses owned scrolling, truthful boundaries, and intrinsic narrow-width reflow", () => {
    const candidateCss = read("src/app/candidates/candidates-command.module.css");
    const draftCss = read("src/app/drafts/drafts-workspace.module.css");
    expect(candidateCss).toContain("repeat(auto-fit,minmax(min(160px,100%),1fr))");
    expect(candidateCss).toContain('.list[data-scrolled="true"] .columns');
    expect(draftCss).toContain('.queue[data-scrolled="true"]>.planeLabel');
    expect(draftCss).toContain('.dialogBody:not([data-at-end="true"])+.dialogActions');
    expect(draftCss).toContain("@container (max-width:520px)");
  });
});
