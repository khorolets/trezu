"use client";

/**
 * Visual editor for a manifest's `args` — the call arguments, where field values get wired in. The
 * top level is the args object's key→value entries; each value is an `ArgNode` whose type the
 * author picks (text / field / number / boolean / null / object / array). String leaves may embed
 * `{{field}}` placeholders: a "field" value is a single picked field; a "text" value is free text
 * with an "+ field" inserter. Objects and arrays nest recursively. Edits flow back as the same
 * `ArgNode` tree the model serializes, so `parseManifest` validates placeholders live.
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
    SINGLE_FIELD_RE,
    valueTypeOf,
} from "../args-node";
import type { ArgEntry, ArgNode } from "../draft";

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
                // biome-ignore lint/suspicious/noArrayIndexKey: controlled rows, no local state
                <div key={index} className="flex items-start gap-2">
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
                onClick={() =>
                    onChange([
                        ...entries,
                        { key: "", value: { kind: "string", value: "" } },
                    ])
                }
            >
                <Plus className="size-4" /> Add key
            </Button>
        </div>
    );
}

interface ItemsEditorProps {
    items: ArgNode[];
    fieldNames: string[];
    onChange: (items: ArgNode[]) => void;
}

function ItemsEditor({ items, fieldNames, onChange }: ItemsEditorProps) {
    return (
        <div className="flex flex-col gap-2 border-l pl-3">
            {items.map((item, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: controlled rows, no local state
                <div key={index} className="flex items-start gap-2">
                    <span className="mt-2 w-6 shrink-0 text-muted-foreground text-xs">
                        {index}
                    </span>
                    <NodeEditor
                        node={item}
                        fieldNames={fieldNames}
                        onChange={(value) =>
                            onChange(
                                items.map((existing, i) =>
                                    i === index ? value : existing,
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
                onClick={() =>
                    onChange([...items, { kind: "string", value: "" }])
                }
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
    const valueType = valueTypeOf(node);

    return (
        <div className="flex flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
                <Select
                    value={valueType}
                    onValueChange={(value) =>
                        onChange(
                            changeType(node, value as ArgValueType, fieldNames),
                        )
                    }
                >
                    <SelectTrigger className="w-28 shrink-0">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {ARG_VALUE_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
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
