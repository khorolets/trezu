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
