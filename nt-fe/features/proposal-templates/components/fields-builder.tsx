"use client";

/**
 * The Fields section of the visual constructor: an add/remove/reorder list of `FieldDraft` rows.
 * Each row edits one form input — name, label, type, required, and (for `select`) its options,
 * which are always shown since they're mandatory. The optional extras — help, validation, default —
 * sit behind a per-row "Advanced options" disclosure so simple fields stay compact; the disclosure
 * auto-opens when that field has advanced config or a validation error. Errors render under the
 * input they belong to (red field + message). Type-incompatible extras aren't shown; `draftToField`
 * also drops them on serialize, so a type switch can't strand invalid data.
 */
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
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
import { type FieldDraft, makeFieldDraft } from "../draft";
import { errorFor } from "../error-map";
import { MANIFEST_FIELD_TYPES, type ManifestFieldType } from "../manifest";

const NUMERIC_TYPES: ManifestFieldType[] = ["uint", "amount", "number"];
const PATTERN_TYPES: ManifestFieldType[] = ["text", "number"];

function hasAdvanced(field: FieldDraft): boolean {
    return Boolean(
        field.help ||
            field.default !== undefined ||
            field.validation.min ||
            field.validation.max ||
            field.validation.pattern,
    );
}

interface FieldsBuilderProps {
    fields: FieldDraft[];
    errors: string[];
    onChange: (fields: FieldDraft[]) => void;
}

export function FieldsBuilder({
    fields,
    errors,
    onChange,
}: FieldsBuilderProps) {
    function updateField(index: number, patch: Partial<FieldDraft>) {
        onChange(
            fields.map((field, i) =>
                i === index ? { ...field, ...patch } : field,
            ),
        );
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
                    key={field.key}
                    field={field}
                    path={`fields.${index}`}
                    errors={errors}
                    canMoveUp={index > 0}
                    canMoveDown={index < fields.length - 1}
                    onChange={(patch) => updateField(index, patch)}
                    onRemove={() =>
                        onChange(fields.filter((_, i) => i !== index))
                    }
                    onMove={(delta) => moveField(index, delta)}
                />
            ))}
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => onChange([...fields, makeFieldDraft()])}
            >
                <Plus className="size-4" /> Add field
            </Button>
        </div>
    );
}

interface FieldRowProps {
    field: FieldDraft;
    path: string;
    errors: string[];
    canMoveUp: boolean;
    canMoveDown: boolean;
    onChange: (patch: Partial<FieldDraft>) => void;
    onRemove: () => void;
    onMove: (delta: number) => void;
}

function FieldRow({
    field,
    path,
    errors,
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

    const minError = errorFor(errors, `${path}.validation.min`);
    const maxError = errorFor(errors, `${path}.validation.max`);
    const patternError = errorFor(errors, `${path}.validation.pattern`);
    const defaultError = errorFor(errors, `${path}.default`);
    const advancedError = minError || maxError || patternError || defaultError;

    const [open, setOpen] = useState(() => hasAdvanced(field));
    const showAdvanced = open || Boolean(advancedError);

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
                    <LabeledInput
                        label="Name"
                        value={field.name}
                        onChange={(value) => onChange({ name: value })}
                        placeholder="greeting"
                        error={errorFor(errors, `${path}.name`)}
                    />
                    <LabeledInput
                        label="Label"
                        value={field.label}
                        onChange={(value) => onChange({ label: value })}
                        placeholder="Greeting"
                        error={errorFor(errors, `${path}.label`)}
                    />
                    <Labeled label="Type">
                        <Select
                            value={field.type}
                            onValueChange={(value) =>
                                // Clear default on a type switch (can't mismatch the new type), and
                                // clear `required` when moving to bool — it's not allowed there and
                                // the bool row has no Required switch to clear it from.
                                onChange({
                                    type: value as ManifestFieldType,
                                    default: undefined,
                                    ...(value === "bool"
                                        ? { required: false }
                                        : {}),
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

            {field.type === "select" ? (
                <Labeled label="Options (one per line)">
                    <Textarea
                        rows={3}
                        className="font-mono text-xs"
                        value={field.options.join("\n")}
                        aria-invalid={
                            errorFor(errors, `${path}.options`)
                                ? true
                                : undefined
                        }
                        onChange={(event) =>
                            onChange({
                                options: event.target.value
                                    .split("\n")
                                    .map((line) => line.trim())
                                    .filter(Boolean),
                            })
                        }
                        placeholder={"option-a\noption-b"}
                    />
                    <FieldError message={errorFor(errors, `${path}.options`)} />
                </Labeled>
            ) : null}

            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="flex items-center gap-1 self-start text-muted-foreground text-xs transition-colors hover:text-foreground"
            >
                {showAdvanced ? (
                    <ChevronUp className="size-3.5" />
                ) : (
                    <ChevronDown className="size-3.5" />
                )}
                Advanced options
            </button>

            {showAdvanced ? (
                <div className="flex flex-col gap-3 border-t pt-3">
                    <LabeledInput
                        label="Help"
                        value={field.help}
                        onChange={(value) => onChange({ help: value })}
                        placeholder="Shown under the input"
                    />

                    {isNumeric ? (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            <LabeledInput
                                label="Min"
                                value={field.validation.min}
                                onChange={(value) =>
                                    setValidation({ min: value })
                                }
                                placeholder="0"
                                error={minError}
                            />
                            <LabeledInput
                                label="Max"
                                value={field.validation.max}
                                onChange={(value) =>
                                    setValidation({ max: value })
                                }
                                error={maxError}
                            />
                        </div>
                    ) : null}

                    {allowsPattern ? (
                        <LabeledInput
                            label="Pattern (regex)"
                            value={field.validation.pattern}
                            onChange={(value) =>
                                setValidation({ pattern: value })
                            }
                            placeholder="^[A-Za-z]"
                            error={patternError}
                        />
                    ) : null}

                    {showDefault ? (
                        <LabeledInput
                            label="Default (optional)"
                            value={String(field.default ?? "")}
                            onChange={setDefault}
                            error={defaultError}
                        />
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

export function LabeledInput({
    label,
    value,
    onChange,
    placeholder,
    error,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    error?: string;
}) {
    return (
        <Labeled label={label}>
            <Input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                aria-invalid={error ? true : undefined}
            />
            <FieldError message={error} />
        </Labeled>
    );
}

export function FieldError({ message }: { message?: string }) {
    if (!message) {
        return null;
    }
    return <p className="text-destructive text-xs">{message}</p>;
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
