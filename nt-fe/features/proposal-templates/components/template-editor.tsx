"use client";

/**
 * Code-mode authoring form shared by the create and edit pages: a name field + a manifest JSON
 * textarea, validated live against the same `parseManifest` schema the renderer uses. It owns the
 * form state and validation only — the page supplies `onSubmit` (create vs update) and the submit
 * label, so this stays agnostic of which mutation runs.
 */
import { useState } from "react";
import { Button } from "@/components/button";
import { PageCard } from "@/components/card";
import { InputBlock } from "@/components/input-block";
import { LargeInput } from "@/components/large-input";
import { Textarea } from "@/components/textarea";
import { validateManifestText } from "../manifest";

const EXAMPLE = `{
  "version": 1,
  "id": "my-template",
  "title": "My Template",
  "binding": {
    "receiver_id": "contract.near",
    "method_name": "some_method",
    "deposit": "0",
    "gas": "30000000000000"
  },
  "fields": [
    { "name": "amount", "label": "Amount", "type": "uint", "required": true }
  ],
  "args": { "amount": "{{amount}}" }
}`;

interface TemplateEditorProps {
    initialName?: string;
    initialManifestText?: string;
    submitLabel: string;
    /** Label shown on the submit button while the mutation runs (defaults to "Saving…"). */
    submittingLabel?: string;
    /** Called with the trimmed name and the validated manifest when the user submits. */
    onSubmit: (values: {
        name: string;
        manifest: unknown;
    }) => void | Promise<void>;
    submitting?: boolean;
    /** Optional footer slot (e.g. the edit page's delete control). */
    footer?: React.ReactNode;
}

export function TemplateEditor({
    initialName = "",
    initialManifestText = "",
    submitLabel,
    submittingLabel = "Saving…",
    onSubmit,
    submitting = false,
    footer,
}: TemplateEditorProps) {
    const [name, setName] = useState(initialName);
    const [manifestText, setManifestText] = useState(initialManifestText);

    const { manifest, errors } = validateManifestText(manifestText);
    const canSubmit = !!manifest && name.trim().length > 0 && !submitting;

    return (
        <PageCard className="gap-4">
            <InputBlock title="Name" invalid={false}>
                <LargeInput
                    borderless
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Recovery Mint"
                />
            </InputBlock>

            <InputBlock title="Manifest (JSON)" invalid={errors.length > 0}>
                <Textarea
                    borderless
                    rows={16}
                    className="font-mono text-xs"
                    value={manifestText}
                    onChange={(event) => setManifestText(event.target.value)}
                    placeholder={EXAMPLE}
                />
            </InputBlock>

            {errors.length > 0 ? (
                <ul className="list-disc pl-5 text-destructive text-sm">
                    {errors.map((message) => (
                        <li key={message}>{message}</li>
                    ))}
                </ul>
            ) : null}

            <Button
                type="button"
                size="lg"
                className="w-full"
                disabled={!canSubmit}
                onClick={() =>
                    manifest && onSubmit({ name: name.trim(), manifest })
                }
            >
                {submitting ? submittingLabel : submitLabel}
            </Button>

            {footer}
        </PageCard>
    );
}
