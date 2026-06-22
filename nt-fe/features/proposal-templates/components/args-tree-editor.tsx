"use client";

/**
 * Args-first editor: each argument is the unit. A top-level argument is **Static** (a fixed value —
 * text/number/bool/null/object/array, `{{field}}` allowed in text) or **Dynamic** (a member input),
 * in which case its value is `{{key}}` and the row expands to that input's config inline (the field
 * named `key`). Renaming a dynamic key renames its field too, so args + fields update atomically via
 * one `onChange({ args, fields })`. Nested object/array values are static-only here; a member input
 * inside them is a composed `{{placeholder}}` configured under "Other inputs".
 */
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
    ARG_VALUE_TYPES,
    type ArgValueType,
    changeType,
    emptyNodeOf,
    isDynamicArg,
    valueTypeOf,
} from "../args-node";
import {
    type ArgEntry,
    type ArgItem,
    type ArgNode,
    type FieldDraft,
    makeArgEntry,
    makeArgItem,
} from "../draft";
import { FieldConfigFields } from "./fields-builder";

/** Static value kinds — "field" is excluded (a direct member input is the Dynamic mode instead). */
const STATIC_TYPES: ArgValueType[] = ARG_VALUE_TYPES.filter(
    (type) => type !== "field",
);

/** The static value-type to display for a node (a lone placeholder reads as plain text here). */
function staticTypeOf(node: ArgNode): ArgValueType {
    const inferred = valueTypeOf(node);
    return inferred === "field" ? "text" : inferred;
}

interface ArgsTreeEditorProps {
    args: ArgEntry[];
    fields: FieldDraft[];
    fieldNames: string[];
    errors: string[];
    onChange: (next: { args: ArgEntry[]; fields: FieldDraft[] }) => void;
}

/** Top-level args editor — entries carry the Static/Dynamic choice. */
export function ArgsTreeEditor({
    args,
    fields,
    fieldNames,
    errors,
    onChange,
}: ArgsTreeEditorProps) {
    return (
        <div className="flex flex-col gap-2">
            {args.map((entry, index) => (
                <TopEntryRow
                    key={entry.id}
                    args={args}
                    index={index}
                    fields={fields}
                    fieldNames={fieldNames}
                    errors={errors}
                    onChange={onChange}
                />
            ))}
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() =>
                    onChange({ args: [...args, makeArgEntry()], fields })
                }
            >
                <Plus className="size-4" /> Add argument
            </Button>
        </div>
    );
}

interface TopEntryRowProps {
    args: ArgEntry[];
    index: number;
    fields: FieldDraft[];
    fieldNames: string[];
    errors: string[];
    onChange: (next: { args: ArgEntry[]; fields: FieldDraft[] }) => void;
}

function TopEntryRow({
    args,
    index,
    fields,
    fieldNames,
    errors,
    onChange,
}: TopEntryRowProps) {
    const entry = args[index];
    const dynamic = isDynamicArg(entry);
    const fieldIndex = fields.findIndex((field) => field.name === entry.key);
    const field = fields[fieldIndex];

    const setArgs = (next: ArgEntry[]) => onChange({ args: next, fields });
    const replace = (next: ArgEntry) =>
        setArgs(args.map((existing, i) => (i === index ? next : existing)));

    function setKey(key: string) {
        if (dynamic) {
            // Rename the field with the key and re-point the placeholder — atomically.
            onChange({
                args: args.map((existing, i) =>
                    i === index
                        ? {
                              ...existing,
                              key,
                              value: { kind: "string", value: `{{${key}}}` },
                          }
                        : existing,
                ),
                fields: fields.map((candidate) =>
                    candidate.name === entry.key
                        ? { ...candidate, name: key }
                        : candidate,
                ),
            });
            return;
        }
        replace({ ...entry, key });
    }

    function setDynamic(next: boolean) {
        if (next) {
            // Value becomes {{key}}; normalizeFields (at the top) creates the field.
            replace({
                ...entry,
                value: { kind: "string", value: `{{${entry.key}}}` },
            });
            return;
        }
        replace({ ...entry, value: { kind: "string", value: "" } });
    }

    function setStaticType(type: ArgValueType) {
        replace({ ...entry, value: changeType(entry.value, type, fieldNames) });
    }

    function setValue(value: ArgNode) {
        replace({ ...entry, value });
    }

    function setFieldConfig(patch: Partial<FieldDraft>) {
        onChange({
            args,
            fields: fields.map((candidate, i) =>
                i === fieldIndex ? { ...candidate, ...patch } : candidate,
            ),
        });
    }

    return (
        <div className="flex flex-col gap-2 rounded-xl bg-muted p-3">
            <div className="flex items-center gap-2">
                <Input
                    className="w-40 shrink-0"
                    value={entry.key}
                    onChange={(event) => setKey(event.target.value)}
                    placeholder="argument"
                />
                <Select
                    value={dynamic ? "dynamic" : "static"}
                    onValueChange={(value) => setDynamic(value === "dynamic")}
                >
                    <SelectTrigger className="w-32 shrink-0">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="static">Static</SelectItem>
                        <SelectItem value="dynamic" disabled={entry.key === ""}>
                            Member input
                        </SelectItem>
                    </SelectContent>
                </Select>
                {dynamic ? (
                    <span className="flex-1 font-mono text-muted-foreground text-xs">{`{{${entry.key}}}`}</span>
                ) : (
                    <StaticValue
                        type={staticTypeOf(entry.value)}
                        node={entry.value}
                        fieldNames={fieldNames}
                        onTypeChange={setStaticType}
                        onChange={setValue}
                    />
                )}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() =>
                        setArgs(args.filter((_, i) => i !== index))
                    }
                >
                    <Trash2 className="size-4" />
                </Button>
            </div>

            {dynamic && field ? (
                <div className="border-l pl-3">
                    <FieldConfigFields
                        field={field}
                        path={`fields.${fieldIndex}`}
                        errors={errors}
                        onChange={setFieldConfig}
                    />
                </div>
            ) : null}

            {!dynamic && entry.value.kind === "object" ? (
                <StaticEntriesEditor
                    entries={entry.value.entries}
                    fieldNames={fieldNames}
                    onChange={(entries) =>
                        setValue({ kind: "object", entries })
                    }
                />
            ) : null}
            {!dynamic && entry.value.kind === "array" ? (
                <StaticItemsEditor
                    items={entry.value.items}
                    fieldNames={fieldNames}
                    onChange={(items) => setValue({ kind: "array", items })}
                />
            ) : null}
        </div>
    );
}

/** Static value editor: a type dropdown + the matching inline control (object/array nest below). */
function StaticValue({
    type,
    node,
    fieldNames,
    onTypeChange,
    onChange,
}: {
    type: ArgValueType;
    node: ArgNode;
    fieldNames: string[];
    onTypeChange: (type: ArgValueType) => void;
    onChange: (node: ArgNode) => void;
}) {
    return (
        <div className="flex flex-1 items-center gap-2">
            <Select
                value={type}
                onValueChange={(value) => onTypeChange(value as ArgValueType)}
            >
                <SelectTrigger className="w-24 shrink-0">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {STATIC_TYPES.map((staticType) => (
                        <SelectItem key={staticType} value={staticType}>
                            {staticType}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <StaticLeaf node={node} fieldNames={fieldNames} onChange={onChange} />
        </div>
    );
}

/** The scalar editor for a static value (object/array carry no inline control — they nest). */
function StaticLeaf({
    node,
    fieldNames,
    onChange,
}: {
    node: ArgNode;
    fieldNames: string[];
    onChange: (node: ArgNode) => void;
}) {
    if (node.kind === "string") {
        return (
            <div className="flex flex-1 items-center gap-2">
                <Input
                    className="flex-1 font-mono text-xs"
                    value={node.value}
                    onChange={(event) =>
                        onChange({ kind: "string", value: event.target.value })
                    }
                    placeholder="text or {{field}}"
                />
                {fieldNames.length > 0 ? (
                    <Select
                        value=""
                        onValueChange={(name) =>
                            onChange({
                                kind: "string",
                                value: `${node.value}{{${name}}}`,
                            })
                        }
                    >
                        <SelectTrigger className="w-auto shrink-0 gap-1 text-xs">
                            + field
                        </SelectTrigger>
                        <SelectContent>
                            {fieldNames.map((name) => (
                                <SelectItem key={name} value={name}>
                                    {name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                ) : null}
            </div>
        );
    }
    if (node.kind === "number") {
        return (
            <Input
                type="number"
                className="flex-1"
                value={String(node.value)}
                onChange={(event) =>
                    onChange({
                        kind: "number",
                        value: Number(event.target.value),
                    })
                }
            />
        );
    }
    if (node.kind === "boolean") {
        return (
            <Switch
                checked={node.value}
                onCheckedChange={(checked) =>
                    onChange({ kind: "boolean", value: checked })
                }
            />
        );
    }
    // null / object / array carry no inline editor.
    return <div className="flex-1" />;
}

/** Static key→value entries inside a nested object (no Dynamic here — use a composed placeholder). */
function StaticEntriesEditor({
    entries,
    fieldNames,
    onChange,
}: {
    entries: ArgEntry[];
    fieldNames: string[];
    onChange: (entries: ArgEntry[]) => void;
}) {
    return (
        <div className="flex flex-col gap-2 border-l pl-3">
            {entries.map((entry, index) => (
                <div key={entry.id} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <Input
                            className="w-40 shrink-0"
                            value={entry.key}
                            onChange={(event) =>
                                onChange(
                                    entries.map((existing, i) =>
                                        i === index
                                            ? {
                                                  ...existing,
                                                  key: event.target.value,
                                              }
                                            : existing,
                                    ),
                                )
                            }
                            placeholder="key"
                        />
                        <StaticValue
                            type={staticTypeOf(entry.value)}
                            node={entry.value}
                            fieldNames={fieldNames}
                            onTypeChange={(type) =>
                                onChange(
                                    entries.map((existing, i) =>
                                        i === index
                                            ? {
                                                  ...existing,
                                                  value: changeType(
                                                      existing.value,
                                                      type,
                                                      fieldNames,
                                                  ),
                                              }
                                            : existing,
                                    ),
                                )
                            }
                            onChange={(value) =>
                                onChange(
                                    entries.map((existing, i) =>
                                        i === index
                                            ? { ...existing, value }
                                            : existing,
                                    ),
                                )
                            }
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() =>
                                onChange(entries.filter((_, i) => i !== index))
                            }
                        >
                            <Trash2 className="size-4" />
                        </Button>
                    </div>
                    {entry.value.kind === "object" ? (
                        <StaticEntriesEditor
                            entries={entry.value.entries}
                            fieldNames={fieldNames}
                            onChange={(nested) =>
                                onChange(
                                    entries.map((existing, i) =>
                                        i === index
                                            ? {
                                                  ...existing,
                                                  value: {
                                                      kind: "object",
                                                      entries: nested,
                                                  },
                                              }
                                            : existing,
                                    ),
                                )
                            }
                        />
                    ) : null}
                    {entry.value.kind === "array" ? (
                        <StaticItemsEditor
                            items={entry.value.items}
                            fieldNames={fieldNames}
                            onChange={(nested) =>
                                onChange(
                                    entries.map((existing, i) =>
                                        i === index
                                            ? {
                                                  ...existing,
                                                  value: {
                                                      kind: "array",
                                                      items: nested,
                                                  },
                                              }
                                            : existing,
                                    ),
                                )
                            }
                        />
                    ) : null}
                </div>
            ))}
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => onChange([...entries, makeArgEntry()])}
            >
                <Plus className="size-4" /> Add key
            </Button>
        </div>
    );
}

/** Static array items (all static). New items match the last item's kind. */
function StaticItemsEditor({
    items,
    fieldNames,
    onChange,
}: {
    items: ArgItem[];
    fieldNames: string[];
    onChange: (items: ArgItem[]) => void;
}) {
    function addItem() {
        const last = items.at(-1)?.value;
        const seed = last
            ? emptyNodeOf(staticTypeOf(last), fieldNames)
            : { kind: "string" as const, value: "" };
        onChange([...items, makeArgItem(seed)]);
    }

    return (
        <div className="flex flex-col gap-2 border-l pl-3">
            {items.map((item, index) => (
                <div key={item.id} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <span className="w-6 shrink-0 text-muted-foreground text-xs">
                            {index}
                        </span>
                        <StaticValue
                            type={staticTypeOf(item.value)}
                            node={item.value}
                            fieldNames={fieldNames}
                            onTypeChange={(type) =>
                                onChange(
                                    items.map((existing, i) =>
                                        i === index
                                            ? {
                                                  ...existing,
                                                  value: changeType(
                                                      existing.value,
                                                      type,
                                                      fieldNames,
                                                  ),
                                              }
                                            : existing,
                                    ),
                                )
                            }
                            onChange={(value) =>
                                onChange(
                                    items.map((existing, i) =>
                                        i === index
                                            ? { ...existing, value }
                                            : existing,
                                    ),
                                )
                            }
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() =>
                                onChange(items.filter((_, i) => i !== index))
                            }
                        >
                            <Trash2 className="size-4" />
                        </Button>
                    </div>
                </div>
            ))}
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={addItem}
            >
                <Plus className="size-4" /> Add item
            </Button>
        </div>
    );
}
