"use client";

/**
 * Render a validated manifest as a react-hook-form form using the trezu design system: each field
 * is an `InputBlock` (muted card, label as title, help as an info tooltip, red on invalid) wrapping
 * a borderless input chosen by `type`. Validated by `buildFormSchema`; on submit the parsed values
 * go to `onSubmit` for the engine (`buildTemplateProposal`).
 *
 * Inputs are controlled (value/onChange/onBlur, no RHF registration ref) — the same way the house
 * `account-id-input` / payments fields wire LargeInput/Textarea. The form is dynamic (its shape is
 * the runtime manifest), so values flow as the generic `FieldValues`.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { type ControllerRenderProps, useForm } from "react-hook-form";
import { Button } from "@/components/button";
import { InputBlock } from "@/components/input-block";
import { LargeInput } from "@/components/large-input";
import { Textarea } from "@/components/textarea";
import { Form, FormField, FormItem, FormMessage } from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { FieldValues } from "../build-proposal";
import { buildFormSchema, defaultValuesFor } from "../form-schema";
import type { Manifest, ManifestField } from "../manifest";

interface ManifestFormProps {
    manifest: Manifest;
    onSubmit: (values: FieldValues) => void;
    submitting?: boolean;
    submitLabel?: string;
}

type FieldControl = ControllerRenderProps<FieldValues, string>;

const SELECT_TRIGGER_CLASS =
    "h-auto w-full border-0 bg-transparent px-0 shadow-none focus-visible:ring-0";

/** The current value as a string for text-like inputs (form state is string-valued except bool). */
function asText(value: unknown): string {
    return typeof value === "string" ? value : "";
}

/** Draw the borderless input that matches a field's `type`. Validation lives in `buildFormSchema`. */
function FieldControlInput({
    field,
    control,
}: {
    field: ManifestField;
    control: FieldControl;
}) {
    switch (field.type) {
        case "bool":
            return (
                <div className="pt-1">
                    <Switch
                        checked={Boolean(control.value)}
                        onCheckedChange={control.onChange}
                    />
                </div>
            );
        case "select":
            return (
                <Select
                    value={asText(control.value)}
                    onValueChange={control.onChange}
                >
                    <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                        <SelectValue placeholder="Choose an option" />
                    </SelectTrigger>
                    <SelectContent>
                        {(field.options ?? []).map((option) => (
                            <SelectItem key={option} value={option}>
                                {option}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            );
        case "json":
            return (
                <Textarea
                    borderless
                    rows={3}
                    value={asText(control.value)}
                    onChange={control.onChange}
                    onBlur={control.onBlur}
                    placeholder="{ }"
                />
            );
        case "number":
            return (
                <LargeInput
                    borderless
                    type="number"
                    value={asText(control.value)}
                    onChange={control.onChange}
                    onBlur={control.onBlur}
                />
            );
        default:
            // account, token, uint, amount, text — a free string input.
            return (
                <LargeInput
                    borderless
                    value={asText(control.value)}
                    onChange={control.onChange}
                    onBlur={control.onBlur}
                />
            );
    }
}

export function ManifestForm({
    manifest,
    onSubmit,
    submitting,
    submitLabel,
}: ManifestFormProps) {
    const form = useForm<FieldValues>({
        resolver: zodResolver(buildFormSchema(manifest)),
        defaultValues: defaultValuesFor(manifest),
        mode: "onBlur",
    });

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex flex-col gap-3"
            >
                {manifest.fields.map((field) => (
                    <FormField
                        key={field.name}
                        control={form.control}
                        name={field.name}
                        render={({ field: control, fieldState }) => (
                            <FormItem>
                                <InputBlock
                                    title={`${field.label}${field.required ? " *" : ""}`}
                                    info={field.help}
                                    invalid={!!fieldState.error}
                                >
                                    <FieldControlInput
                                        field={field}
                                        control={control}
                                    />
                                </InputBlock>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                ))}
                <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={submitting}
                >
                    {submitLabel ?? "File proposal"}
                </Button>
            </form>
        </Form>
    );
}
