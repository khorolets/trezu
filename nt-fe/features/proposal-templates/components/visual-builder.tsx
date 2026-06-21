"use client";

/**
 * The visual constructor body: edits a `ManifestDraft` through sectioned form controls instead of
 * raw JSON. Details + on-chain binding + the fields list are fully editable here; `args` is shown
 * read-only for now (a dedicated tree editor is the next layer — until then args is edited in Code
 * mode). `icon` isn't surfaced but rides along in the draft, so round-tripping never drops it.
 */
import { Input } from "@/components/ui/input";
import { argNodeToJson, type ManifestDraft } from "../draft";
import { FieldsBuilder, Labeled } from "./fields-builder";

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

interface VisualBuilderProps {
    draft: ManifestDraft;
    onChange: (draft: ManifestDraft) => void;
}

export function VisualBuilder({ draft, onChange }: VisualBuilderProps) {
    const update = (patch: Partial<ManifestDraft>) =>
        onChange({ ...draft, ...patch });
    const updateBinding = (patch: Partial<ManifestDraft["binding"]>) =>
        onChange({ ...draft, binding: { ...draft.binding, ...patch } });

    const argsJson = JSON.stringify(
        argNodeToJson({ kind: "object", entries: draft.args }),
        null,
        2,
    );

    return (
        <div className="flex flex-col gap-4">
            <Section title="Details">
                <div className="grid gap-3 sm:grid-cols-2">
                    <Labeled label="ID (slug)">
                        <Input
                            value={draft.id}
                            onChange={(event) =>
                                update({ id: event.target.value })
                            }
                            placeholder="recovery-mint"
                        />
                    </Labeled>
                    <Labeled label="Title">
                        <Input
                            value={draft.title}
                            onChange={(event) =>
                                update({ title: event.target.value })
                            }
                            placeholder="Recovery Mint"
                        />
                    </Labeled>
                </div>
                <Labeled label="Description (optional)">
                    <Input
                        value={draft.description}
                        onChange={(event) =>
                            update({ description: event.target.value })
                        }
                    />
                </Labeled>
                <Labeled label="Summary (optional, supports {{fields}})">
                    <Input
                        value={draft.summary}
                        onChange={(event) =>
                            update({ summary: event.target.value })
                        }
                        placeholder="Mint {{amount}}"
                    />
                </Labeled>
            </Section>

            <Section
                title="On-chain call"
                description="The fixed FunctionCall this template files."
            >
                <div className="grid gap-3 sm:grid-cols-2">
                    <Labeled label="Receiver (contract)">
                        <Input
                            value={draft.binding.receiver_id}
                            onChange={(event) =>
                                updateBinding({
                                    receiver_id: event.target.value,
                                })
                            }
                            placeholder="omft.near"
                        />
                    </Labeled>
                    <Labeled label="Method">
                        <Input
                            value={draft.binding.method_name}
                            onChange={(event) =>
                                updateBinding({
                                    method_name: event.target.value,
                                })
                            }
                            placeholder="ft_deposit"
                        />
                    </Labeled>
                    <Labeled label="Deposit (yoctoNEAR)">
                        <Input
                            value={draft.binding.deposit}
                            onChange={(event) =>
                                updateBinding({ deposit: event.target.value })
                            }
                            placeholder="0"
                        />
                    </Labeled>
                    <Labeled label="Gas">
                        <Input
                            value={draft.binding.gas}
                            onChange={(event) =>
                                updateBinding({ gas: event.target.value })
                            }
                            placeholder="30000000000000"
                        />
                    </Labeled>
                </div>
            </Section>

            <Section
                title="Fields"
                description="The inputs members fill when filing a proposal."
            >
                <FieldsBuilder
                    fields={draft.fields}
                    onChange={(fields) => update({ fields })}
                />
            </Section>

            <Section
                title="Arguments"
                description="How field values map into the call. Visual editing arrives in the next layer — edit in Code mode for now."
            >
                <pre className="overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">
                    {argsJson}
                </pre>
            </Section>
        </div>
    );
}
