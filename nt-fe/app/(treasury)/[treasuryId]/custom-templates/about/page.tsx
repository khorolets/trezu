"use client";

/**
 * In-app docs for the custom-proposal manifest DSL — reached from the sidebar "Custom" header's "?".
 * Lives at the reserved `about` slug so it never collides with a template's page. Mirrors
 * `docs/CUSTOM_PROPOSAL_TEMPLATES.md`.
 */
import { PageCard } from "@/components/card";
import { PageComponentLayout } from "@/components/page-component-layout";
import { cn } from "@/lib/utils";

/** Inline code chip — Tailwind preflight strips the default <code> styling, so give it some. */
function Code({ children }: { children: React.ReactNode }) {
    return (
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
            {children}
        </code>
    );
}

function CodeBlock({ children }: { children: string }) {
    return (
        <pre className="overflow-auto rounded-lg border bg-muted/60 p-3 font-mono text-xs leading-relaxed">
            {children}
        </pre>
    );
}

function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <PageCard className="gap-3">
            <h2 className="font-semibold text-base text-foreground">{title}</h2>
            <div className="flex flex-col gap-3 text-muted-foreground text-sm leading-relaxed [&_strong]:text-foreground">
                {children}
            </div>
        </PageCard>
    );
}

const FIELD_TYPES: { type: string; renders: string }[] = [
    { type: "account", renders: "a NEAR account id (validated shape)" },
    { type: "token", renders: "an omni token id, e.g. base-0x… (free text)" },
    { type: "uint", renders: "a whole-number string, u128-safe" },
    {
        type: "amount",
        renders: "a whole-number string in base units (no decimals)",
    },
    {
        type: "number",
        renders: "a numeric value (for counts/ratios, not amounts)",
    },
    { type: "text", renders: "free text" },
    { type: "select", renders: "a dropdown of options" },
    { type: "bool", renders: "a toggle" },
    { type: "json", renders: "JSON text" },
];

const EXAMPLE_MANIFEST = `{
  "version": 1,
  "id": "set-greeting",
  "title": "Set Greeting",
  "binding": {
    "receiver_id": "guestbook.near",
    "method_name": "set_greeting",
    "deposit": "0",
    "gas": "30000000000000"
  },
  "fields": [
    { "name": "greeting", "label": "Greeting", "type": "text", "required": true }
  ],
  "args": { "greeting": "{{greeting}}" },
  "summary": "Set greeting to {{greeting}}"
}`;

export default function CustomTemplatesAboutPage() {
    return (
        <PageComponentLayout
            title="About custom templates"
            description="The manifest DSL behind a custom proposal form."
            backButton
        >
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
                <Section title="What a template is">
                    <p>
                        A <strong>manifest</strong> is a JSON form definition. A
                        technical member authors it once; members then fill the
                        rendered form to file a generic SputnikDAO{" "}
                        <Code>FunctionCall</Code> proposal. The proposal still
                        passes the DAO&apos;s normal permissions and approvals —
                        a template never grants authority by itself.
                    </p>
                    <p>
                        Member values flow only into the call&apos;s{" "}
                        <Code>args</Code> (and the human-readable{" "}
                        <Code>summary</Code>). The contract, method, deposit,
                        and gas are fixed by the author.
                    </p>
                </Section>

                <Section title="Authoring is args-first">
                    <p>
                        In <strong>Visual</strong> mode the call is the unit.
                        Each argument is either:
                    </p>
                    <ul className="flex list-disc flex-col gap-1.5 pl-5">
                        <li>
                            <strong>Static</strong> — a fixed value (text /
                            number / bool / object / array; text may embed{" "}
                            <Code>{"{{field}}"}</Code>), or
                        </li>
                        <li>
                            <strong>Member input</strong> — its value becomes{" "}
                            <Code>{"{{key}}"}</Code> and the row expands to that
                            input&apos;s config inline (label, type, required,
                            help, validation). The input&apos;s name is the
                            argument key.
                        </li>
                    </ul>
                    <p>
                        Inputs are derived from placeholders — referencing{" "}
                        <Code>{"{{x}}"}</Code> anywhere creates input{" "}
                        <Code>x</Code>. Inputs used only inside a composed
                        value, or added by hand, appear under{" "}
                        <strong>Other inputs</strong>; one no argument
                        references is flagged <strong>Unused</strong>.{" "}
                        <strong>Code</strong> mode is the same manifest as a
                        JSON textarea.
                    </p>
                </Section>

                <Section title="Top-level shape">
                    <p>
                        <Code>version</Code> (1), <Code>id</Code>,{" "}
                        <Code>title</Code>, optional <Code>description</Code> /{" "}
                        <Code>icon</Code> / <Code>summary</Code>,{" "}
                        <Code>binding</Code>, <Code>fields</Code>, and{" "}
                        <Code>args</Code>.
                    </p>
                    <p>
                        <Code>id</Code> is a tag-safe slug (
                        <Code>[A-Za-z0-9_-]</Code>), unique per DAO — both the
                        page URL and the <Code>[trezu-tmpl:&lt;id&gt;]</Code>{" "}
                        tag stamped on every filed proposal for provenance.
                        Reserved: <Code>create</Code>, <Code>new</Code>,{" "}
                        <Code>about</Code>.
                    </p>
                </Section>

                <Section title="binding — the on-chain call">
                    <p>
                        Fixed per template: <Code>receiver_id</Code>,{" "}
                        <Code>method_name</Code>, <Code>deposit</Code>, and{" "}
                        <Code>gas</Code>. <Code>deposit</Code>/<Code>gas</Code>{" "}
                        are integer strings in base units (yoctoNEAR) — there
                        are no decimals at the contract, and they exceed 2^53 so
                        they must be strings.
                    </p>
                </Section>

                <Section title="fields — the form inputs">
                    <p>
                        Each field has a <Code>name</Code> (referenced from{" "}
                        <Code>args</Code>), <Code>label</Code>,{" "}
                        <Code>type</Code>, and optional <Code>required</Code> /{" "}
                        <Code>default</Code> / <Code>help</Code> /{" "}
                        <Code>options</Code> / <Code>validation</Code>.
                    </p>
                    <ul className="flex flex-col gap-1.5">
                        {FIELD_TYPES.map((row, index) => (
                            <li
                                key={row.type}
                                className={cn(
                                    "flex items-baseline gap-3 py-1",
                                    index > 0 && "border-t",
                                )}
                            >
                                <span className="w-20 shrink-0">
                                    <Code>{row.type}</Code>
                                </span>
                                <span>{row.renders}</span>
                            </li>
                        ))}
                    </ul>
                </Section>

                <Section title="args — interpolation">
                    <p>
                        <Code>args</Code> is the method&apos;s arguments. Each{" "}
                        <Code>{"{{field}}"}</Code> in a string value is replaced
                        with that field&apos;s value before filing. Compose by
                        using several (<Code>{"{{first}}.{{last}}"}</Code> →{" "}
                        <Code>alice.near</Code>); escape with{" "}
                        <Code>{"{{{{literal}}}}"}</Code>. Every placeholder must
                        reference a declared field. Amounts stay digit strings,
                        so u128 values never lose precision.
                    </p>
                </Section>

                <Section title="A minimal example">
                    <p>
                        One text field wired into a <Code>set_greeting</Code>{" "}
                        call. Paste it into a new template&apos;s Code tab, then
                        switch to Visual:
                    </p>
                    <CodeBlock>{EXAMPLE_MANIFEST}</CodeBlock>
                </Section>

                <Section title="Permissions">
                    <p>
                        Authoring (create / edit / delete a template) requires
                        the DAO&apos;s on-chain <Code>ChangePolicy</Code>{" "}
                        permission. Listing and filling require membership.
                        Filing still goes through the DAO&apos;s normal
                        approvals.
                    </p>
                </Section>
            </div>
        </PageComponentLayout>
    );
}
