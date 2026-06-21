"use client";

/**
 * The visual constructor body: edits a `ManifestDraft` through sectioned form controls instead of
 * raw JSON. Validation errors render under the input they're about (red field + message beneath),
 * via `errorFor`. The few that aren't tied to a single input — the cross-field "unique names" rule,
 * `args` placeholder issues — show at their section's foot. `icon` isn't surfaced but rides along
 * in the draft, so round-tripping never drops it.
 */
import type { ManifestDraft } from "../draft";
import { errorFor } from "../error-map";
import { ArgsTreeEditor } from "./args-tree-editor";
import { FieldError, FieldsBuilder, LabeledInput } from "./fields-builder";

/** Errors that belong to the args subtree (not mappable to a single input in the tree). */
function argErrors(errors: string[]): string[] {
    return errors.filter((entry) => entry.split(":")[0].startsWith("args"));
}

/** Errors not claimed by any section's inputs (a safety net so nothing goes unseen). */
function otherErrors(errors: string[]): string[] {
    const claimed = (entry: string) => {
        const path = entry.split(":")[0];
        return (
            path.startsWith("args") ||
            path.startsWith("fields") ||
            path.startsWith("binding") ||
            ["id", "title", "description", "summary", "icon"].includes(path)
        );
    };
    return errors.filter((entry) => !claimed(entry));
}

function Section({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-3 rounded-xl border p-4">
            <div className="flex flex-col gap-0.5">
                <h3 className="font-medium text-sm">{title}</h3>
                {description ? (
                    <p className="text-muted-foreground text-xs">
                        {description}
                    </p>
                ) : null}
            </div>
            {children}
        </div>
    );
}

function ErrorList({ errors }: { errors: string[] }) {
    if (errors.length === 0) {
        return null;
    }
    return (
        <ul className="list-disc pl-5 text-destructive text-sm">
            {errors.map((message) => (
                <li key={message}>{message}</li>
            ))}
        </ul>
    );
}

interface VisualBuilderProps {
    draft: ManifestDraft;
    errors: string[];
    onChange: (draft: ManifestDraft) => void;
}

export function VisualBuilder({ draft, errors, onChange }: VisualBuilderProps) {
    const update = (patch: Partial<ManifestDraft>) =>
        onChange({ ...draft, ...patch });
    const updateBinding = (patch: Partial<ManifestDraft["binding"]>) =>
        onChange({ ...draft, binding: { ...draft.binding, ...patch } });

    return (
        <div className="flex flex-col gap-4">
            <Section title="Details">
                <div className="grid gap-3 sm:grid-cols-2">
                    <LabeledInput
                        label="ID (slug)"
                        value={draft.id}
                        onChange={(value) => update({ id: value })}
                        placeholder="set-greeting"
                        error={errorFor(errors, "id")}
                    />
                    <LabeledInput
                        label="Title"
                        value={draft.title}
                        onChange={(value) => update({ title: value })}
                        placeholder="Set Greeting"
                        error={errorFor(errors, "title")}
                    />
                </div>
                <LabeledInput
                    label="Description (optional)"
                    value={draft.description}
                    onChange={(value) => update({ description: value })}
                    error={errorFor(errors, "description")}
                />
                <LabeledInput
                    label="Summary (optional, supports {{fields}})"
                    value={draft.summary}
                    onChange={(value) => update({ summary: value })}
                    placeholder="Set greeting to {{greeting}}"
                    error={errorFor(errors, "summary")}
                />
            </Section>

            <Section
                title="On-chain call"
                description="The fixed FunctionCall this template files."
            >
                <div className="grid gap-3 sm:grid-cols-2">
                    <LabeledInput
                        label="Receiver (contract)"
                        value={draft.binding.receiver_id}
                        onChange={(value) =>
                            updateBinding({ receiver_id: value })
                        }
                        placeholder="guestbook.near"
                        error={errorFor(errors, "binding.receiver_id")}
                    />
                    <LabeledInput
                        label="Method"
                        value={draft.binding.method_name}
                        onChange={(value) =>
                            updateBinding({ method_name: value })
                        }
                        placeholder="set_greeting"
                        error={errorFor(errors, "binding.method_name")}
                    />
                    <LabeledInput
                        label="Deposit (yoctoNEAR)"
                        value={draft.binding.deposit}
                        onChange={(value) => updateBinding({ deposit: value })}
                        placeholder="0"
                        error={errorFor(errors, "binding.deposit")}
                    />
                    <LabeledInput
                        label="Gas"
                        value={draft.binding.gas}
                        onChange={(value) => updateBinding({ gas: value })}
                        placeholder="30000000000000"
                        error={errorFor(errors, "binding.gas")}
                    />
                </div>
            </Section>

            <Section
                title="Fields"
                description="The inputs members fill when filing a proposal."
            >
                <FieldsBuilder
                    fields={draft.fields}
                    errors={errors}
                    onChange={(fields) => update({ fields })}
                />
                <FieldError message={errorFor(errors, "fields")} />
            </Section>

            <Section
                title="Arguments"
                description="How each field value is wired into the call — pick a field for a direct value, or text with {{field}} placeholders for composed strings."
            >
                <ArgsTreeEditor
                    entries={draft.args}
                    fieldNames={draft.fields
                        .map((field) => field.name)
                        .filter(Boolean)}
                    onChange={(args) => update({ args })}
                />
                <ErrorList errors={argErrors(errors)} />
            </Section>

            <ErrorList errors={otherErrors(errors)} />
        </div>
    );
}
