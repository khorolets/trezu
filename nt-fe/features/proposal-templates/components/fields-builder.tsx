"use client";

/**
 * The Fields section of the visual constructor: an add/remove/reorder list of `FieldDraft` rows.
 * Each row edits one form input — name, label, type, and the type-appropriate extras (select
 * options, numeric min/max, text/number pattern, default). Type-incompatible extras are simply not
 * shown; `draftToField` also drops them on serialize, so a type switch can't strand invalid data.
 */
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/button";
import { Textarea } from "@/components/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { FieldDraft } from "../draft";
import { MANIFEST_FIELD_TYPES, type ManifestFieldType } from "../manifest";

const NEW_FIELD: FieldDraft = {
    name: "",
    label: "",
    type: "text",
    required: false,
    help: "",
    default: undefined,
    options: [],
    validation: { min: "", max: "", pattern: "" },
};

const NUMERIC_TYPES: ManifestFieldType[] = ["uint", "amount", "number"];
const PATTERN_TYPES: ManifestFieldType[] = ["text", "number"];

interface FieldsBuilderProps {
    fields: FieldDraft[];
    onChange: (fields: FieldDraft[]) => void;
}

export function FieldsBuilder({ fields, onChange }: FieldsBuilderProps) {
    function updateField(index: number, patch: Partial<FieldDraft>) {
        onChange(
            fields.map((field, i) =>
                i === index ? { ...field, ...patch } : field,
            ),
        );
    }

    function removeField(index: number) {
        onChange(fields.filter((_, i) => i !== index));
    }

    function moveField(index: number, delta: number) {
        const target = index + delta;
        if (target < 0 || target >= fields.length) {
            return;
        }
        const next = [...fields];
        [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
    }

    return (
        <div className="flex flex-col gap-3">
            {fields.map((field, index) => (
                <FieldRow
                    // Rows are fully controlled (no internal state), so an index key is safe here.
                    // biome-ignore lint/suspicious/noArrayIndexKey: controlled rows, no local state
                    key={index}
                    field={field}
                    canMoveUp={index > 0}
                    canMoveDown={index < fields.length - 1}
                    onChange={(patch) => updateField(index, patch)}
                    onRemove={() => removeField(index)}
                    onMove={(delta) => moveField(index, delta)}
                />
            ))}
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => onChange([...fields, { ...NEW_FIELD }])}
            >
                <Plus className="size-4" /> Add field
            </Button>
        </div>
    );
}

interface FieldRowProps {
    field: FieldDraft;
    canMoveUp: boolean;
    canMoveDown: boolean;
    onChange: (patch: Partial<FieldDraft>) => void;
    onRemove: () => void;
    onMove: (delta: number) => void;
}

function FieldRow({
    field,
    canMoveUp,
    canMoveDown,
    onChange,
    onRemove,
    onMove,
}: FieldRowProps) {
    const requiredId = useId();
    const isNumeric = NUMERIC_TYPES.includes(field.type);
    const allowsPattern = PATTERN_TYPES.includes(field.type);
    const showRequired = field.type !== "bool";
    const showDefault = field.type !== "bool" && field.type !== "json";

    function setDefault(text: string) {
        if (text.trim() === "") {
            onChange({ default: undefined });
            return;
        }
        if (field.type === "number") {
            const value = Number(text);
            // Keep the raw text when it isn't a number so the schema flags the mismatch.
            onChange({ default: Number.isNaN(value) ? text : value });
            return;
        }
        onChange({ default: text });
    }

    function setValidation(patch: Partial<FieldDraft["validation"]>) {
        onChange({ validation: { ...field.validation, ...patch } });
    }

    return (
        <div className="flex flex-col gap-3 rounded-xl bg-muted p-3">
            <div className="flex items-start gap-2">
                <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3">
                    <Labeled label="Name">
                        <Input
                            value={field.name}
                            onChange={(event) =>
                                onChange({ name: event.target.value })
                            }
                            placeholder="amount"
                        />
                    </Labeled>
                    <Labeled label="Label">
                        <Input
                            value={field.label}
                            onChange={(event) =>
                                onChange({ label: event.target.value })
                            }
                            placeholder="Amount"
                        />
                    </Labeled>
                    <Labeled label="Type">
                        <Select
                            value={field.type}
                            onValueChange={(value) =>
                                // Clear the default on a type switch so it can't mismatch the new type.
                                onChange({
                                    type: value as ManifestFieldType,
                                    default: undefined,
                                })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {MANIFEST_FIELD_TYPES.map((type) => (
                                    <SelectItem key={type} value={type}>
                                        {type}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Labeled>
                </div>
                <div className="flex gap-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={!canMoveUp}
                        onClick={() => onMove(-1)}
                    >
                        <ChevronUp className="size-4" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={!canMoveDown}
                        onClick={() => onMove(1)}
                    >
                        <ChevronDown className="size-4" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={onRemove}
                    >
                        <Trash2 className="size-4" />
                    </Button>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
                {showRequired ? (
                    <div className="flex items-center gap-2">
                        <Switch
                            id={requiredId}
                            checked={field.required}
                            onCheckedChange={(checked) =>
                                onChange({ required: checked })
                            }
                        />
                        <Label htmlFor={requiredId} className="text-sm">
                            Required
                        </Label>
                    </div>
                ) : null}
                <Labeled label="Help" className="min-w-[160px] flex-1">
                    <Input
                        value={field.help}
                        onChange={(event) =>
                            onChange({ help: event.target.value })
                        }
                        placeholder="Shown under the input"
                    />
                </Labeled>
            </div>

            {field.type === "select" ? (
                <Labeled label="Options (one per line)">
                    <Textarea
                        rows={3}
                        className="font-mono text-xs"
                        value={field.options.join("\n")}
                        onChange={(event) =>
                            onChange({
                                options: event.target.value
                                    .split("\n")
                                    .map((line) => line.trim())
                                    .filter(Boolean),
                            })
                        }
                        placeholder={"eth\nbase"}
                    />
                </Labeled>
            ) : null}

            {isNumeric || allowsPattern ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {isNumeric ? (
                        <>
                            <Labeled label="Min">
                                <Input
                                    value={field.validation.min}
                                    onChange={(event) =>
                                        setValidation({
                                            min: event.target.value,
                                        })
                                    }
                                    placeholder="0"
                                />
                            </Labeled>
                            <Labeled label="Max">
                                <Input
                                    value={field.validation.max}
                                    onChange={(event) =>
                                        setValidation({
                                            max: event.target.value,
                                        })
                                    }
                                />
                            </Labeled>
                        </>
                    ) : null}
                    {allowsPattern ? (
                        <Labeled label="Pattern (regex)">
                            <Input
                                value={field.validation.pattern}
                                onChange={(event) =>
                                    setValidation({
                                        pattern: event.target.value,
                                    })
                                }
                                placeholder="^0x"
                            />
                        </Labeled>
                    ) : null}
                </div>
            ) : null}

            {showDefault ? (
                <Labeled label="Default (optional)">
                    <Input
                        value={String(field.default ?? "")}
                        onChange={(event) => setDefault(event.target.value)}
                    />
                </Labeled>
            ) : null}
        </div>
    );
}

export function Labeled({
    label,
    className,
    children,
}: {
    label: string;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <div className={cn("flex flex-col gap-1", className)}>
            <Label className="text-muted-foreground text-xs">{label}</Label>
            {children}
        </div>
    );
}
