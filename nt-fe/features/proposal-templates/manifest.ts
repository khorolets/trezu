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
 * normalized copy, while this validator additionally (a) checks each field's `type`, (b) requires
 * the amount strings `binding.deposit`/`gas` and per-field `validation.min`/`max` to be digit
 * strings, and (c) cross-checks that every `{{field}}` placeholder in `args`/`summary` is declared
 * in `fields`. A manifest that passes here therefore also passes the backend.
 *
 * u128 safety: those amount strings are validated as digit strings, never `number`, so NEAR
 * amounts (which exceed 2^53) survive untruncated.
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

const INTEGER_RE = /^\d+$/;

const integerString = (label: string) =>
    z.string().regex(INTEGER_RE, `${label} must be an integer string`);

// The manifest id is wrapped in the `[trezu-tmpl:<id>]` description tag, so it must be tag-safe.
const TAG_SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/;
const tagSafeId = z
    .string()
    .trim()
    .regex(
        TAG_SAFE_ID_RE,
        "id must be a tag-safe slug ([A-Za-z0-9_-]) so the [trezu-tmpl:<id>] tag stays parseable",
    );

/** Optional per-field constraints. min/max are digit strings to stay u128/BigInt-safe. */
export const manifestFieldValidationSchema = z.object({
    min: integerString("validation.min").optional(),
    max: integerString("validation.max").optional(),
    pattern: z.string().optional(),
});

const manifestFieldBase = z.object({
    name: nonBlankString("field.name"),
    label: nonBlankString("field.label"),
    type: manifestFieldTypeSchema,
    required: z.boolean().optional(),
    // zod v4: z.unknown() already admits `undefined`, so no `.optional()` needed. Its shape is
    // tied to `type` by the refinements below, not left arbitrary.
    default: z.unknown(),
    help: z.string().optional(),
    /** Choices for a `select` field (required there, forbidden elsewhere). */
    options: z.array(z.string()).optional(),
    validation: manifestFieldValidationSchema.optional(),
});

type ManifestFieldBase = z.infer<typeof manifestFieldBase>;

/** `options` is required for `select` and forbidden on every other type. */
function optionsMatchType(field: ManifestFieldBase): boolean {
    return field.type === "select"
        ? Array.isArray(field.options) && field.options.length > 0
        : field.options === undefined;
}

/** `validation.pattern` (a regex) only applies to free-text inputs. */
function patternMatchesType(field: ManifestFieldBase): boolean {
    return (
        field.validation?.pattern === undefined ||
        field.type === "text" ||
        field.type === "number"
    );
}

/** A field's `default`, when present, must match its declared `type`. */
function defaultMatchesType(field: ManifestFieldBase): boolean {
    const value = field.default;
    if (value === undefined) {
        return true;
    }
    switch (field.type) {
        case "account":
        case "token":
        case "text":
            return typeof value === "string";
        case "uint":
        case "amount":
            return typeof value === "string" && INTEGER_RE.test(value);
        case "number":
            return typeof value === "number";
        case "bool":
            return typeof value === "boolean";
        case "select":
            return (
                typeof value === "string" &&
                (field.options?.includes(value) ?? false)
            );
        case "json":
            return true;
        default:
            return false;
    }
}

export const manifestFieldSchema = manifestFieldBase
    .refine(optionsMatchType, {
        message:
            "`options` is required for a `select` field and forbidden otherwise",
        path: ["options"],
    })
    .refine(patternMatchesType, {
        message:
            "`validation.pattern` is only valid on `text` or `number` fields",
        path: ["validation", "pattern"],
    })
    .refine(defaultMatchesType, {
        message: "`default` does not match the field's `type`",
        path: ["default"],
    });
export type ManifestField = z.infer<typeof manifestFieldSchema>;

/** The on-chain call the template produces. Fixed in v1 (no user-driven binding). */
export const manifestBindingSchema = z.object({
    receiver_id: nonBlankString("binding.receiver_id"),
    method_name: nonBlankString("binding.method_name"),
    deposit: integerString("binding.deposit"),
    gas: integerString("binding.gas"),
});
export type ManifestBinding = z.infer<typeof manifestBindingSchema>;

/**
 * `{{field}}` placeholder pattern. The look-arounds skip escaped `{{{{literal}}}}` sequences so a
 * literal `{{` is never mistaken for a placeholder.
 */
const PLACEHOLDER_RE = /(?<!\{)\{\{\s*([a-zA-Z0-9_]+)\s*\}\}(?!\})/g;

function collectStrings(value: unknown, out: string[]): void {
    if (typeof value === "string") {
        out.push(value);
        return;
    }
    if (Array.isArray(value)) {
        for (const item of value) collectStrings(item, out);
        return;
    }
    if (value !== null && typeof value === "object") {
        for (const item of Object.values(value)) collectStrings(item, out);
    }
}

/**
 * Field names a manifest references via `{{name}}` in its `args` mapping and `summary`. Exported
 * so the form engine interpolates against the exact same extraction this validator checks.
 */
export function manifestPlaceholders(
    args: unknown,
    summary?: string,
): Set<string> {
    const strings: string[] = [];
    collectStrings(args, strings);
    if (summary) {
        strings.push(summary);
    }
    const names = new Set<string>();
    for (const text of strings) {
        for (const match of text.matchAll(PLACEHOLDER_RE)) {
            const name = match[1];
            if (name) {
                names.add(name);
            }
        }
    }
    return names;
}

export const manifestSchema = z
    .object({
        version: z.number().int().positive(),
        id: tagSafeId,
        title: nonBlankString("title"),
        description: z.string().optional(),
        icon: z.string().optional(),
        binding: manifestBindingSchema,
        fields: z.array(manifestFieldSchema),
        // `args` must be a plain object (z.record admits arrays in zod v4; z.object does not).
        args: z.object({}).catchall(z.unknown()),
        summary: z.string().optional(),
    })
    .refine(
        (manifest) => {
            const declared = new Set(
                manifest.fields.map((field) => field.name),
            );
            return [
                ...manifestPlaceholders(manifest.args, manifest.summary),
            ].every((placeholder) => declared.has(placeholder));
        },
        {
            message:
                "args/summary reference a {{placeholder}} that no field declares",
            path: ["args"],
        },
    )
    .refine(
        (manifest) => {
            const names = manifest.fields.map((field) => field.name);
            return new Set(names).size === names.length;
        },
        {
            message: "field `name`s must be unique within a manifest",
            path: ["fields"],
        },
    );
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
