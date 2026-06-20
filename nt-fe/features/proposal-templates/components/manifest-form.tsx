"use client";

/**
 * Render a validated manifest as a react-hook-form form: one input per field, chosen by `type`,
 * validated by `buildFormSchema` (per type/required/validation). On submit the parsed values are
 * handed to `onSubmit` for the engine (`buildTemplateProposal`) to turn into a proposal.
 *
 * The form is *dynamic* — its shape is the runtime manifest, not a statically-inferred type — so
 * values flow as the generic `FieldValues`. That's the one place this differs from the repo's
 * static forms; everything else (Form/FormField/FormMessage, zodResolver) follows the house style.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { type ControllerRenderProps, useForm } from "react-hook-form";
import { Button } from "@/components/button";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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

/** The current value as a string for text-like inputs (form state is string-valued except bool). */
function asText(value: unknown): string {
    return typeof value === "string" ? value : "";
}

/** Draw the input that matches a field's `type`. Validation lives in `buildFormSchema`. */
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
                <Switch
                    checked={control.value === true}
                    onCheckedChange={control.onChange}
                    onBlur={control.onBlur}
                    ref={control.ref}
                />
            );
        case "select":
            return (
                <Select
                    value={asText(control.value)}
                    onValueChange={control.onChange}
                >
                    <SelectTrigger onBlur={control.onBlur} ref={control.ref}>
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
                    name={control.name}
                    value={asText(control.value)}
                    onChange={control.onChange}
                    onBlur={control.onBlur}
                    ref={control.ref}
                    placeholder="{ }"
                />
            );
        case "number":
            return (
                <Input
                    type="number"
                    name={control.name}
                    value={asText(control.value)}
                    onChange={control.onChange}
                    onBlur={control.onBlur}
                    ref={control.ref}
                />
            );
        default:
            // account, token, uint, amount, text — a free string input.
            return (
                <Input
                    name={control.name}
                    value={asText(control.value)}
                    onChange={control.onChange}
                    onBlur={control.onBlur}
                    ref={control.ref}
                    placeholder={field.help}
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
                className="flex max-w-[600px] flex-col gap-4"
            >
                {manifest.fields.map((field) => (
                    <FormField
                        key={field.name}
                        control={form.control}
                        name={field.name}
                        render={({ field: control }) => (
                            <FormItem>
                                <FormLabel>
                                    {field.label}
                                    {field.required ? " *" : ""}
                                </FormLabel>
                                <FormControl>
                                    <FieldControlInput
                                        field={field}
                                        control={control}
                                    />
                                </FormControl>
                                {field.help ? (
                                    <FormDescription>
                                        {field.help}
                                    </FormDescription>
                                ) : null}
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                ))}
                <Button type="submit" disabled={submitting}>
                    {submitLabel ?? "File proposal"}
                </Button>
            </form>
        </Form>
    );
}
