"use client";

/**
 * In-app intro to custom proposal templates — reached from the sidebar "Custom" header's "?".
 * Lives at the reserved `about` slug so it never collides with a template's page. Written for DAO
 * operators, not developers. The full DSL reference is `docs/CUSTOM_PROPOSAL_TEMPLATES.md`.
 */
import { PageCard } from "@/components/card";
import { PageComponentLayout } from "@/components/page-component-layout";

/** Inline code chip — Tailwind preflight strips the default <code> styling, so give it some. */
function Code({ children }: { children: React.ReactNode }) {
    return (
        <code className="mx-px rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8em] text-foreground">
            {children}
        </code>
    );
}

/** A styled outbound link, for the skill + reference doc on GitHub. */
function DocLink({
    href,
    children,
}: {
    href: string;
    children: React.ReactNode;
}) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary underline underline-offset-4 hover:no-underline"
        >
            {children}
        </a>
    );
}

function CodeBlock({ children }: { children: string }) {
    return (
        <pre className="overflow-x-auto rounded-lg border bg-muted p-4 font-mono text-xs leading-relaxed">
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
        <PageCard className="gap-4">
            <h2 className="font-semibold text-base">{title}</h2>
            <div className="flex flex-col gap-4 text-[0.9375rem] text-foreground/80 leading-7 [&_strong]:font-medium [&_strong]:text-foreground">
                {children}
            </div>
        </PageCard>
    );
}

const INPUT_KINDS: { kind: string; does: string }[] = [
    { kind: "text", does: "any text, like a name or a message" },
    { kind: "account", does: "a NEAR account, checked for a valid shape" },
    {
        kind: "amount",
        does: "a token amount, as a whole number in the token's smallest unit",
    },
    { kind: "number", does: "a plain number, like a count" },
    { kind: "select", does: "a dropdown of choices you set" },
    { kind: "bool", does: "a yes or no toggle" },
    { kind: "token", does: "a token id" },
    { kind: "json", does: "raw JSON, for advanced values" },
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
            description="Create any contract call your DAO needs, as a reusable form."
            backButton
        >
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
                <Section title="What it's for">
                    <p>
                        trezu can create the common treasury proposals like
                        payments, transfers, and staking. A SputnikDAO can also
                        call any other method on any contract. trezu can show those
                        proposals, but it has no way to create them, so today that
                        takes a developer or a hand-built transaction.
                    </p>
                    <p>
                        Custom templates add that. You turn a contract call into a
                        form once, and after that anyone in the DAO fills it in and
                        files the proposal. The call can be anything your DAO needs,
                        like minting a token, registering an account, or changing a
                        setting.
                    </p>
                </Section>

                <Section title="How it works">
                    <p>
                        Every proposal calls a method on a contract with some
                        values. In a template, each value is one of two things.
                    </p>
                    <ul className="flex list-disc flex-col gap-2.5 pl-5">
                        <li>
                            <strong>Static.</strong> A fixed value, the same every
                            time. The contract and method, plus anything that
                            never changes, like a category or a flag.
                        </li>
                        <li>
                            <strong>Member input.</strong> A blank the member
                            fills in when they file, like an amount, a recipient,
                            or a message.
                        </li>
                    </ul>
                    <p>
                        Make a value a member input and it becomes a form field.
                        That is the whole idea. You decide what stays the same and
                        what people get to choose. Filing one is still a normal
                        proposal, and it goes through your DAO&apos;s usual votes
                        and approvals.
                    </p>
                </Section>

                <Section title="Building one">
                    <p>
                        Open <strong>New template</strong>. In{" "}
                        <strong>Visual</strong> mode you add the arguments and set
                        each one to <strong>Static</strong> or{" "}
                        <strong>Member input</strong>, the same two choices from
                        above. When you pick Member input, its settings show up
                        right below it. You give it a label, choose what kind of
                        value it is, and say whether it is required.
                    </p>
                    <p>
                        Comfortable with JSON? The <strong>Code</strong> tab is the
                        same template as text, for pasting or power edits.
                    </p>
                </Section>

                <Section title="Let an AI assistant build it">
                    <p>
                        You do not have to write the template yourself. We made a
                        small <strong>skill</strong> that teaches an AI assistant
                        the template format. You describe the proposal in plain
                        words, and it writes the template for you to paste into the
                        Code tab.
                    </p>
                    <p>
                        The skill is self-contained, so it works in Claude Code,
                        Claude.ai, Codex, or any assistant that takes a skill or a
                        prompt. Get it here:{" "}
                        <DocLink href="https://github.com/NEAR-DevHub/trezu/tree/main/skills/trezu-custom-proposal-template">
                            trezu-custom-proposal-template
                        </DocLink>
                        .
                    </p>
                </Section>

                <Section title="Kinds of input">
                    <p>
                        When a value is a member input, you choose what kind it
                        is. The form then shows the right control and checks what
                        people enter.
                    </p>
                    <ul className="flex flex-col gap-2.5">
                        {INPUT_KINDS.map((row) => (
                            <li
                                key={row.kind}
                                className="flex items-baseline gap-3"
                            >
                                <span className="w-16 shrink-0">
                                    <Code>{row.kind}</Code>
                                </span>
                                <span>{row.does}</span>
                            </li>
                        ))}
                    </ul>
                    <p>
                        One thing to know about <Code>amount</Code>. On-chain
                        there are no decimals, so you enter the whole number in the
                        token&apos;s smallest unit. For a token with 6 decimals,{" "}
                        <Code>1.5</Code> becomes <Code>1500000</Code>.
                    </p>
                </Section>

                <Section title="A quick example">
                    <p>
                        Here is a template with one text field, wired into a{" "}
                        <Code>set_greeting</Code> call. Paste it into the Code tab
                        of a new template, then switch to Visual to see it as a
                        form.
                    </p>
                    <CodeBlock>{EXAMPLE_MANIFEST}</CodeBlock>
                    <p>
                        The <Code>{"{{greeting}}"}</Code> is the link. Whatever a
                        member types in the <strong>Greeting</strong> field lands
                        right there in the call. You can combine fields the same
                        way, so <Code>{"{{first}}.{{last}}"}</Code> becomes{" "}
                        <Code>alice.near</Code>.
                    </p>
                </Section>

                <Section title="Who can build and use them">
                    <p>
                        Building or changing a template needs a permission your DAO
                        grants. It is the same one used to change the DAO&apos;s
                        policy. Anyone in the DAO can fill in a template and file
                        the proposal. And a template never grants new powers. It
                        only files a proposal your DAO could already approve.
                    </p>
                    <p className="text-muted-foreground text-sm">
                        Want the exact field rules and JSON shape? See the full{" "}
                        <DocLink href="https://github.com/NEAR-DevHub/trezu/blob/main/docs/CUSTOM_PROPOSAL_TEMPLATES.md">
                            reference doc
                        </DocLink>
                        .
                    </p>
                </Section>
            </div>
        </PageComponentLayout>
    );
}
