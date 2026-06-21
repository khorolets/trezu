"use client";

/**
 * Docs for the custom-proposal manifest DSL — reached from the sidebar "Custom" header's "?" button.
 * Lives at the reserved `about` slug (no template can claim it), so it never collides with a
 * template's `/custom-templates/<slug>` page.
 */
import { PageCard } from "@/components/card";
import { PageComponentLayout } from "@/components/page-component-layout";

const FIELD_TYPES: { type: string; renders: string }[] = [
    { type: "account", renders: "NEAR account id (validated shape)" },
    { type: "token", renders: "omni token id, e.g. base-0x… (free text)" },
    { type: "uint / amount", renders: "whole-number string, u128-safe" },
    { type: "number", renders: "numeric string" },
    { type: "text", renders: "free text" },
    { type: "select", renders: "dropdown of options" },
    { type: "bool", renders: "toggle" },
    { type: "json", renders: "JSON text" },
];

function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <PageCard className="gap-2">
            <h2 className="font-semibold text-sm">{title}</h2>
            <div className="flex flex-col gap-2 text-muted-foreground text-sm">
                {children}
            </div>
        </PageCard>
    );
}

export default function CustomTemplatesAboutPage() {
    return (
        <PageComponentLayout
            title="About custom templates"
            description="The manifest DSL behind a custom proposal form."
            backButton
        >
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
                <Section title="What a manifest is">
                    <p>
                        A <strong>manifest</strong> is a JSON form definition. A
                        technical member authors it once; regular members then
                        fill the rendered form to file a generic SputnikDAO{" "}
                        <code>FunctionCall</code> proposal — which still passes
                        the DAO&apos;s on-chain permissions and approvals.
                    </p>
                </Section>

                <Section title="Top-level shape">
                    <p>
                        <code>version</code> (1), <code>id</code> (slug),{" "}
                        <code>title</code>, optional <code>description</code> /{" "}
                        <code>icon</code> / <code>summary</code>,{" "}
                        <code>binding</code>, <code>fields</code>, and{" "}
                        <code>args</code>.
                    </p>
                    <p>
                        The <code>id</code> is a tag-safe slug (
                        <code>[A-Za-z0-9_-]</code>), unique per DAO. It is both
                        the page URL (<code>/custom-templates/&lt;id&gt;</code>)
                        and the <code>[trezu-tmpl:&lt;id&gt;]</code> tag stamped
                        on every filed proposal for provenance. Reserved slugs (
                        <code>create</code>, <code>new</code>,{" "}
                        <code>about</code>) are not allowed.
                    </p>
                </Section>

                <Section title="binding — the on-chain call">
                    <p>
                        Fixed per template: <code>receiver_id</code>,{" "}
                        <code>method_name</code>, <code>deposit</code>{" "}
                        (yoctoNEAR digit string), and <code>gas</code> (digit
                        string). Members fill <em>fields</em>, never the
                        binding.
                    </p>
                </Section>

                <Section title="fields — the form inputs">
                    <p>
                        Each field has a <code>name</code> (referenced from{" "}
                        <code>args</code>), a <code>label</code>, a{" "}
                        <code>type</code>, and optional <code>required</code> /{" "}
                        <code>default</code> / <code>help</code> /{" "}
                        <code>options</code> / <code>validation</code> (
                        <code>min</code>/<code>max</code>/<code>pattern</code>).
                    </p>
                    <ul className="flex flex-col gap-1">
                        {FIELD_TYPES.map((row) => (
                            <li key={row.type}>
                                <code>{row.type}</code> — {row.renders}
                            </li>
                        ))}
                    </ul>
                </Section>

                <Section title="args — interpolation">
                    <p>
                        <code>args</code> is a JSON template for the call&apos;s
                        arguments. Each <code>{"{{field}}"}</code> placeholder
                        is replaced with that field&apos;s value before filing;
                        an escaped <code>{"{{{{literal}}}}"}</code> stays a
                        literal <code>{"{{literal}}"}</code>. Every placeholder
                        must reference a declared field. Amounts stay digit
                        strings end-to-end, so u128 values never lose precision.
                    </p>
                </Section>
            </div>
        </PageComponentLayout>
    );
}
