/**
 * Manifest schema for the custom-proposal framework (frontend source of truth).
 *
 * A *manifest* is a JSON form definition: a techy DAO member authors it, regular members fill the
 * rendered form to file a generic SputnikDAO `FunctionCall` proposal. This module is the single
 * validated shape both the authoring UI (validate before save) and the form engine (interpret the
 * fields) build on.
 *
 * It mirrors — and deliberately extends — the backend `validate_manifest` (nt-be
 * `handlers/proposal_templates.rs`): the backend enforces only the structural shape and stores a
 * normalized copy, while this validator additionally checks field types and that amount-like
 * strings are integers. A manifest that passes here therefore also passes the backend.
 *
 * u128 safety: `deposit`/`gas` and the per-field `validation.min`/`max` are **strings**, never
 * `number`, so NEAR amounts (which exceed 2^53) survive untruncated.
 */
import { z } from "zod";

/** Field input types a manifest may declare; each maps to a trezu form component. */
export const MANIFEST_FIELD_TYPES = [
    "account",
    "token",
    "uint",
    "amount",
    "text",
    "number",
    "select",
    "bool",
    "json",
] as const;

export const manifestFieldTypeSchema = z.enum(MANIFEST_FIELD_TYPES);
export type ManifestFieldType = z.infer<typeof manifestFieldTypeSchema>;

const nonBlankString = (label: string) =>
    z.string().trim().min(1, `${label} must not be blank`);

/** Optional per-field constraints. min/max are strings to stay u128/BigInt-safe. */
export const manifestFieldValidationSchema = z.object({
    min: z.string().optional(),
    max: z.string().optional(),
    pattern: z.string().optional(),
});

export const manifestFieldSchema = z.object({
    name: nonBlankString("field.name"),
    label: nonBlankString("field.label"),
    type: manifestFieldTypeSchema,
    required: z.boolean().optional(),
    default: z.unknown().optional(),
    help: z.string().optional(),
    /** Choices for a `select` field. */
    options: z.array(z.string()).optional(),
    validation: manifestFieldValidationSchema.optional(),
});
export type ManifestField = z.infer<typeof manifestFieldSchema>;

/** The on-chain call the template produces. Fixed in v1 (no user-driven binding). */
export const manifestBindingSchema = z.object({
    receiver_id: nonBlankString("binding.receiver_id"),
    method_name: nonBlankString("binding.method_name"),
    deposit: z
        .string()
        .regex(/^\d+$/, "binding.deposit must be a yoctoNEAR integer string"),
    gas: z
        .string()
        .regex(/^\d+$/, "binding.gas must be a gas-unit integer string"),
});
export type ManifestBinding = z.infer<typeof manifestBindingSchema>;

export const manifestSchema = z.object({
    version: z.number().int().positive(),
    id: nonBlankString("id"),
    title: nonBlankString("title"),
    description: z.string().optional(),
    icon: z.string().optional(),
    binding: manifestBindingSchema,
    fields: z.array(manifestFieldSchema),
    /** Args-mapping template the form engine interpolates field values into. */
    args: z.record(z.string(), z.unknown()),
    summary: z.string().optional(),
});
export type Manifest = z.infer<typeof manifestSchema>;

/** Validate an authored manifest (e.g. pasted JSON). Returns zod's safe-parse result. */
export function parseManifest(input: unknown) {
    return manifestSchema.safeParse(input);
}

/** Flatten a manifest validation error into `path: message` lines for the authoring UI. */
export function manifestErrorMessages(error: z.ZodError): string[] {
    return error.issues.map((issue) => {
        const path = issue.path.join(".");
        return path ? `${path}: ${issue.message}` : issue.message;
    });
}
