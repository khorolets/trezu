"use client";

/**
 * The visual constructor body: edits a `ManifestDraft` through sectioned form controls instead of
 * raw JSON. Validation errors render under the input they're about (red field + message beneath),
 * via `errorFor`. The few that aren't tied to a single input — the cross-field "unique names" rule,
 * `args` placeholder issues — show at their section's foot. `icon` isn't surfaced but rides along
 * in the draft, so round-tripping never drops it.
 */
import { dynamicArgNames } from "../args-node";
import { type ManifestDraft, usedFieldNames } from "../draft";
import { errorFor, isInlineErrorPath } from "../error-map";
import { ArgsTreeEditor } from "./args-tree-editor";
import { FieldsBuilder, LabeledInput } from "./fields-builder";

/** Errors in the args subtree — shown at the Arguments section's foot (not mappable per-leaf). */
function argErrors(errors: string[]): string[] {
    return errors.filter((entry) => entry.split(":")[0].startsWith("args"));
}

/** Field errors not tied to one input: the bounds refine, the unique-names rule, a stray `required`. */
function fieldsSectionErrors(errors: string[]): string[] {
    return errors.filter((entry) => {
        const path = entry.split(":")[0];
        return path.startsWith("fields") && !isInlineErrorPath(path);
    });
}

/** Anything no input renders and no section above claims — the final safety net. */
function otherErrors(errors: string[]): string[] {
    return errors.filter((entry) => {
        const path = entry.split(":")[0];
        return (
            !path.startsWith("args") &&
            !path.startsWith("fields") &&
            !isInlineErrorPath(path)
        );
    });
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
    /**
     * Whether to show the cross-input section-foot errors (duplicate keys, unique-names, unknown
     * placeholders). Per-input errors self-gate on their own touch inside each input; these don't
     * belong to a single input, so the parent gates them on the builder having been touched at all.
     */
    showSectionErrors: boolean;
    onChange: (draft: ManifestDraft) => void;
}

export function VisualBuilder({
    draft,
    errors,
    showSectionErrors,
    onChange,
}: VisualBuilderProps) {
    const update = (patch: Partial<ManifestDraft>) =>
        onChange({ ...draft, ...patch });
    const updateBinding = (patch: Partial<ManifestDraft["binding"]>) =>
        onChange({ ...draft, binding: { ...draft.binding, ...patch } });
    const used = usedFieldNames(draft);
    const inlineNames = dynamicArgNames(draft.args);

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
                title="Arguments"
                description="The arguments sent to the contract. Each is Static (a fixed value) or a Member input (dynamic) — for the latter, the input's config appears inline."
            >
                <ArgsTreeEditor
                    args={draft.args}
                    fields={draft.fields}
                    fieldNames={draft.fields
                        .map((field) => field.name)
                        .filter(Boolean)}
                    errors={errors}
                    onChange={({ args, fields }) => update({ args, fields })}
                />
                <ErrorList
                    errors={showSectionErrors ? argErrors(errors) : []}
                />
            </Section>

            <Section
                title="Other inputs"
                description="Inputs used only inside a composed value (not a direct member-input argument), plus any you add manually. Most templates have none."
            >
                <FieldsBuilder
                    fields={draft.fields}
                    errors={errors}
                    usedNames={used}
                    hideNames={inlineNames}
                    onChange={(fields) => update({ fields })}
                />
                <ErrorList
                    errors={
                        showSectionErrors ? fieldsSectionErrors(errors) : []
                    }
                />
            </Section>

            <ErrorList errors={showSectionErrors ? otherErrors(errors) : []} />
        </div>
    );
}
