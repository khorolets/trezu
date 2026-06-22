/**
 * Look up a validation error by its path and return a display-ready message. Errors arrive as
 * `path: message` lines (from `manifestErrorMessages`), and the zod messages tend to repeat the
 * field name ("binding.receiver_id must not be blank"). The visual builder shows each message right
 * under its input, so we strip that leading field token — it reads "Must not be blank" beside the
 * field it's already visually attached to. Code mode keeps the full pathful lines.
 */
export function errorFor(errors: string[], path: string): string | undefined {
    const line = errors.find((entry) => entry.startsWith(`${path}:`));
    if (!line) {
        return undefined;
    }
    return cleanMessage(line.slice(path.length + 1).trim());
}

/**
 * Whether an error path is rendered inline under a specific input in the visual builder. The
 * routing uses this so anything NOT shown inline (cross-field refines like `fields.N.validation`
 * bounds or `fields.N.required`, the unique-names rule, etc.) still reaches a visible catch-all
 * list — no error can be silently dropped while Save stays disabled.
 */
export function isInlineErrorPath(path: string): boolean {
    if (["id", "title", "description", "summary"].includes(path)) {
        return true;
    }
    if (/^binding\.(receiver_id|method_name|deposit|gas)$/.test(path)) {
        return true;
    }
    return /^fields\.\d+\.(name|label|default|options|validation\.(min|max|pattern))$/.test(
        path,
    );
}

/** Drop a leading field-path token before the verb ("title must …", "binding.x is …"). */
function cleanMessage(message: string): string {
    const stripped = message.replace(
        /^[`'"\w.[\]]+\s+(?=(?:must|is|are|has|does|may|cannot|should|references)\b)/i,
        "",
    );
    return stripped.length > 0
        ? stripped[0].toUpperCase() + stripped.slice(1)
        : message;
}
