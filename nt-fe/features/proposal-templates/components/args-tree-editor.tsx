"use client";

/**
 * Visual editor for a manifest's `args` — the call arguments, where field values get wired in. The
 * top level is the args object's key→value entries; each value is an `ArgNode` whose type the
 * author picks (text / field / number / boolean / null / object / array). String leaves may embed
 * `{{field}}` placeholders: a "field" value is a single picked field; a "text" value is free text
 * with an "+ field" inserter. Objects and arrays nest recursively. Rows are keyed by a stable `id`
 * so reordering tears down/rebuilds (no carried-over `explicitType`). Edits flow back as the same
 * `ArgNode` tree the model serializes, so `parseManifest` validates placeholders live.
 */
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
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
    resolveDisplayType,
    SINGLE_FIELD_RE,
    valueTypeOf,
} from "../args-node";
import {
    type ArgEntry,
    type ArgItem,
    type ArgNode,
    makeArgEntry,
    makeArgItem,
} from "../draft";

interface ArgsTreeEditorProps {
    entries: ArgEntry[];
    fieldNames: string[];
    onChange: (entries: ArgEntry[]) => void;
}

/** Top-level args editor: the args object is always a set of key→value entries. */
export function ArgsTreeEditor({
    entries,
    fieldNames,
    onChange,
}: ArgsTreeEditorProps) {
    return (
        <EntriesEditor
            entries={entries}
            fieldNames={fieldNames}
            onChange={onChange}
        />
    );
}

interface EntriesEditorProps {
    entries: ArgEntry[];
    fieldNames: string[];
    onChange: (entries: ArgEntry[]) => void;
    indent?: boolean;
}

function EntriesEditor({
    entries,
    fieldNames,
    onChange,
    indent,
}: EntriesEditorProps) {
    function update(index: number, patch: Partial<ArgEntry>) {
        onChange(
            entries.map((entry, i) =>
                i === index ? { ...entry, ...patch } : entry,
            ),
        );
    }

    return (
        <div className={cn("flex flex-col gap-2", indent && "border-l pl-3")}>
            {entries.map((entry, index) => (
                <div key={entry.id} className="flex items-start gap-2">
                    <Input
                        className="w-40 shrink-0"
                        value={entry.key}
                        onChange={(event) =>
                            update(index, { key: event.target.value })
                        }
                        placeholder="key"
                    />
                    <NodeEditor
                        node={entry.value}
                        fieldNames={fieldNames}
                        onChange={(value) => update(index, { value })}
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

interface ItemsEditorProps {
    items: ArgItem[];
    fieldNames: string[];
    onChange: (items: ArgItem[]) => void;
}

function ItemsEditor({ items, fieldNames, onChange }: ItemsEditorProps) {
    // New items match the last item's type so a homogeneous array doesn't force a dropdown flip on
    // every add; an empty array starts with an empty string.
    function addItem() {
        const last = items.at(-1)?.value;
        const seed = last
            ? emptyNodeOf(valueTypeOf(last), fieldNames)
            : { kind: "string" as const, value: "" };
        onChange([...items, makeArgItem(seed)]);
    }

    return (
        <div className="flex flex-col gap-2 border-l pl-3">
            {items.map((item, index) => (
                <div key={item.id} className="flex items-start gap-2">
                    <span className="mt-2 w-6 shrink-0 text-muted-foreground text-xs">
                        {index}
                    </span>
                    <NodeEditor
                        node={item.value}
                        fieldNames={fieldNames}
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

interface NodeEditorProps {
    node: ArgNode;
    fieldNames: string[];
    onChange: (node: ArgNode) => void;
}

function NodeEditor({ node, fieldNames, onChange }: NodeEditorProps) {
    // The user's explicit type pick, held so a "text" choice on a lone `{{placeholder}}` (which
    // `changeType` leaves unchanged, inferring back to "field") doesn't snap the dropdown back.
    const [explicitType, setExplicitType] = useState<ArgValueType | null>(null);

    // Forget the pick once the node's value/kind actually changes (e.g. the user edited the leaf),
    // so the dropdown follows the data again rather than getting stuck on a stale choice.
    const shape = node.kind === "string" ? node.value : node.kind;
    // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the node's shape changes
    useEffect(() => {
        setExplicitType(null);
    }, [shape]);

    const valueType = resolveDisplayType(node, explicitType);
    const noFields = fieldNames.length === 0;

    return (
        <div className="flex flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
                <Select
                    value={valueType}
                    onValueChange={(value) => {
                        const next = value as ArgValueType;
                        setExplicitType(next);
                        onChange(changeType(node, next, fieldNames));
                    }}
                >
                    <SelectTrigger className="w-28 shrink-0">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {ARG_VALUE_TYPES.map((type) => (
                            <SelectItem
                                key={type}
                                value={type}
                                disabled={type === "field" && noFields}
                            >
                                {type}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <LeafEditor
                    node={node}
                    valueType={valueType}
                    fieldNames={fieldNames}
                    onChange={onChange}
                />
            </div>

            {node.kind === "object" ? (
                <EntriesEditor
                    entries={node.entries}
                    fieldNames={fieldNames}
                    onChange={(entries) =>
                        onChange({ kind: "object", entries })
                    }
                    indent
                />
            ) : null}
            {node.kind === "array" ? (
                <ItemsEditor
                    items={node.items}
                    fieldNames={fieldNames}
                    onChange={(items) => onChange({ kind: "array", items })}
                />
            ) : null}
        </div>
    );
}

function LeafEditor({
    node,
    valueType,
    fieldNames,
    onChange,
}: {
    node: ArgNode;
    valueType: ArgValueType;
    fieldNames: string[];
    onChange: (node: ArgNode) => void;
}) {
    if (node.kind === "string" && valueType === "field") {
        if (fieldNames.length === 0) {
            return (
                <p className="flex-1 text-muted-foreground text-xs">
                    Declare a field first.
                </p>
            );
        }
        const current = SINGLE_FIELD_RE.exec(node.value)?.[1] ?? "";
        return (
            <Select
                value={current}
                onValueChange={(name) =>
                    onChange({ kind: "string", value: `{{${name}}}` })
                }
            >
                <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Pick a field" />
                </SelectTrigger>
                <SelectContent>
                    {fieldNames.map((name) => (
                        <SelectItem key={name} value={name}>
                            {name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        );
    }

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

    // null / object / array carry no inline editor (object/array nest below).
    return <div className="flex-1" />;
}
