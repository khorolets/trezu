"use client";

/**
 * Authoring form shared by create and edit, with a Code | Visual toggle over the manifest. Code
 * mode is a JSON textarea; Visual mode is the sectioned `VisualBuilder`. Both feed the same
 * `parseManifest`, so errors and submit behave identically regardless of mode. The page supplies
 * `onSubmit` (create vs update) and the labels; this stays agnostic of which mutation runs.
 *
 * State: the name (the DB record name, separate from the manifest), the code textarea string, and
 * the visual draft. Switching Code → Visual parses the textarea into a draft (blocked on invalid
 * JSON); Visual → Code serializes the draft back to text. The active mode is the source of truth.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/button";
import { PageCard } from "@/components/card";
import { InputBlock } from "@/components/input-block";
import { LargeInput } from "@/components/large-input";
import { TabGroup } from "@/components/tab-group";
import { Textarea } from "@/components/textarea";
import { duplicateArgKeys } from "../args-node";
import {
    draftToManifest,
    emptyDraft,
    jsonToDraft,
    type ManifestDraft,
    normalizeFields,
} from "../draft";
import {
    type Manifest,
    manifestErrorMessages,
    parseManifest,
    validateManifestText,
} from "../manifest";
import { VisualBuilder } from "./visual-builder";

const EXAMPLE = `{
  "version": 1,
  "id": "set-greeting",
  "title": "Set Greeting",
  "description": "Update the greeting shown on a guest-book contract.",
  "binding": {
    "receiver_id": "guestbook.near",
    "method_name": "set_greeting",
    "deposit": "0",
    "gas": "30000000000000"
  },
  "fields": [
    { "name": "greeting", "label": "Greeting", "type": "text", "required": true, "help": "The new message" }
  ],
  "args": { "greeting": "{{greeting}}" },
  "summary": "Set greeting to {{greeting}}"
}`;

type Mode = "visual" | "code";

/** Derive a manifest + error lines from the visual draft via the same validator code mode uses. */
function manifestFromDraft(draft: ManifestDraft): {
    manifest?: Manifest;
    errors: string[];
} {
    const parsed = parseManifest(draftToManifest(draft));
    const baseErrors = parsed.success
        ? []
        : manifestErrorMessages(parsed.error);
    // Duplicate args keys collapse on serialize (last-write-wins), so parseManifest can't see them;
    // detect them on the draft and block save with a visible error in the Arguments section.
    const dupeErrors = duplicateArgKeys(draft.args).map(({ path, key }) => {
        const where = path ? `args.${path}` : "args";
        return `${where}: duplicate argument key "${key}" — only the last is kept`;
    });
    const errors = [...baseErrors, ...dupeErrors];
    if (parsed.success && dupeErrors.length === 0) {
        return { manifest: parsed.data, errors };
    }
    return { errors };
}

/** Empty text (a new template) or any syntactically valid JSON may open in Visual mode. */
function isParseableJson(text: string): boolean {
    if (!text.trim()) {
        return true;
    }
    try {
        JSON.parse(text);
        return true;
    } catch {
        return false;
    }
}

/** Hydrate the initial draft leniently; blank or unparseable text falls back to an empty draft. */
function parseDraft(text: string): ManifestDraft {
    if (!text.trim()) {
        return emptyDraft();
    }
    try {
        return normalizeFields(jsonToDraft(JSON.parse(text)));
    } catch {
        return emptyDraft();
    }
}

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
    // Default to Visual; fall back to Code only when editing a manifest that doesn't parse.
    const [mode, setMode] = useState<Mode>(() =>
        isParseableJson(initialManifestText) ? "visual" : "code",
    );
    const [draft, setDraft] = useState<ManifestDraft>(() =>
        parseDraft(initialManifestText),
    );
    // Suppress the error list until the author edits, so a blank new template isn't a wall of red.
    const [touched, setTouched] = useState(false);

    const { manifest, errors } =
        mode === "code"
            ? validateManifestText(manifestText)
            : manifestFromDraft(draft);
    const showErrors = touched && errors.length > 0;
    const nameMissing = name.trim().length === 0;
    const canSubmit = !!manifest && !nameMissing && !submitting;

    function switchMode(next: string) {
        const target = next as Mode;
        if (target === mode) {
            return;
        }
        if (target === "visual") {
            let parsed: unknown;
            try {
                parsed = manifestText.trim() ? JSON.parse(manifestText) : {};
            } catch {
                toast.error(
                    "Fix the invalid JSON before switching to the visual builder",
                );
                return;
            }
            setDraft(normalizeFields(jsonToDraft(parsed)));
            setMode("visual");
            return;
        }
        // → Code: serialize the current draft into the textarea.
        setManifestText(JSON.stringify(draftToManifest(draft), null, 2));
        setMode("code");
    }

    return (
        <PageCard className="gap-4">
            <InputBlock title="Name" invalid={touched && nameMissing}>
                <LargeInput
                    borderless
                    value={name}
                    onChange={(event) => {
                        setName(event.target.value);
                        setTouched(true);
                    }}
                    placeholder="Set Greeting"
                />
                {touched && nameMissing ? (
                    <p className="text-destructive text-sm">Name is required</p>
                ) : null}
            </InputBlock>

            <TabGroup
                tabs={[
                    { value: "visual", label: "Visual" },
                    { value: "code", label: "Code" },
                ]}
                activeTab={mode}
                onTabChange={switchMode}
            />

            {mode === "code" ? (
                <InputBlock title="Manifest (JSON)" invalid={showErrors}>
                    <Textarea
                        borderless
                        rows={16}
                        className="font-mono text-xs"
                        value={manifestText}
                        onChange={(event) => {
                            setManifestText(event.target.value);
                            setTouched(true);
                        }}
                        placeholder={EXAMPLE}
                    />
                </InputBlock>
            ) : (
                <VisualBuilder
                    draft={draft}
                    errors={showErrors ? errors : []}
                    onChange={(next) => {
                        setDraft(normalizeFields(next));
                        setTouched(true);
                    }}
                />
            )}

            {mode === "code" && showErrors ? (
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
