import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SimulationUnavailableControl } from "./simulation-control";

describe("SimulationUnavailableControl", () => {
  it("renders an accessible disabled action without a form", () => {
    const markup = renderToStaticMarkup(<SimulationUnavailableControl/>);
    expect(markup).toContain("disabled");
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain("npm run db:seed");
    expect(markup).not.toContain("<form");
  });
});
