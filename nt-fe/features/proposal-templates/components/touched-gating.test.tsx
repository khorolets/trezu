/**
 * Pins the "no red until touched" contract for the authoring form. Uses react-dom/server (no DOM
 * harness, no testing-library) to assert the *initial* render — i.e. the load state, before any
 * blur/edit — which is exactly the regression these tests guard against ("red whole form on load").
 * The interactive half (error appears *after* blur) belongs in the Playwright e2e.
 */
import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyDraft } from "../draft";
import { LabeledInput } from "./fields-builder";
import { VisualBuilder } from "./visual-builder";

describe("LabeledInput touched gating", () => {
    it("does not render its error before the input is touched", () => {
        const html = renderToStaticMarkup(
            <LabeledInput
                label="Receiver"
                value=""
                onChange={() => {}}
                error="receiver is required"
            />,
        );
        expect(html).not.toContain("receiver is required");
    });
});

describe("VisualBuilder section-error gating", () => {
    // An `args:`-prefixed error is routed to the Arguments section foot (a cross-input error).
    const sectionError =
        'args: duplicate argument key "x" — only the last is kept';

    function render(showSectionErrors: boolean): string {
        return renderToStaticMarkup(
            <VisualBuilder
                draft={emptyDraft()}
                errors={[sectionError]}
                showSectionErrors={showSectionErrors}
                onChange={() => {}}
            />,
        );
    }

    it("hides section-foot errors until the builder has been touched", () => {
        expect(render(false)).not.toContain("duplicate argument key");
    });

    it("shows section-foot errors once the builder has been touched", () => {
        expect(render(true)).toContain("duplicate argument key");
    });
});
