"use client";

/**
 * Author a proposal template (code mode): paste/edit the manifest JSON, validated live against the
 * same `parseManifest` schema the renderer uses, then save via the `ChangePolicy`-gated create
 * endpoint. Lives at the reserved `create` slug (no template can claim it). A visual constructor is
 * a deliberate follow-up — this is the code half.
 */
import { isAxiosError } from "axios";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/button";
import { PageCard } from "@/components/card";
import { InputBlock } from "@/components/input-block";
import { LargeInput } from "@/components/large-input";
import { PageComponentLayout } from "@/components/page-component-layout";
import { Textarea } from "@/components/textarea";
import { useCreateProposalTemplate } from "@/features/proposal-templates/hooks/use-proposal-template-mutations";
import {
    manifestErrorMessages,
    manifestIdOf,
    parseManifest,
} from "@/features/proposal-templates/manifest";
import { useTreasury } from "@/hooks/use-treasury";

const EXAMPLE = `{
  "version": 1,
  "id": "my-template",
  "title": "My Template",
  "binding": {
    "receiver_id": "contract.near",
    "method_name": "some_method",
    "deposit": "0",
    "gas": "30000000000000"
  },
  "fields": [
    { "name": "amount", "label": "Amount", "type": "uint", "required": true }
  ],
  "args": { "amount": "{{amount}}" }
}`;

/** Validate the textarea JSON against the manifest schema: returns the parsed manifest or errors. */
function validateManifestText(text: string): {
    manifest?: unknown;
    errors: string[];
} {
    if (!text.trim()) {
        return { errors: [] };
    }
    let json: unknown;
    try {
        json = JSON.parse(text);
    } catch {
        return { errors: ["Manifest is not valid JSON"] };
    }
    const result = parseManifest(json);
    if (!result.success) {
        return { errors: manifestErrorMessages(result.error) };
    }
    return { manifest: result.data, errors: [] };
}

/** The backend returns a plain-string error body (e.g. a 403 or a duplicate-name 409). */
function errorMessage(error: unknown): string {
    if (isAxiosError(error)) {
        const data = error.response?.data;
        if (typeof data === "string" && data.length > 0) {
            return data;
        }
    }
    return error instanceof Error ? error.message : "Failed to create template";
}

export default function CreateTemplatePage() {
    const router = useRouter();
    const { treasuryId } = useTreasury();
    const createTemplate = useCreateProposalTemplate();
    const [name, setName] = useState("");
    const [manifestText, setManifestText] = useState("");

    const { manifest, errors } = validateManifestText(manifestText);
    const canSave =
        !!manifest && name.trim().length > 0 && !createTemplate.isPending;

    async function handleSave() {
        if (!manifest || !treasuryId) {
            return;
        }
        try {
            const created = await createTemplate.mutateAsync({
                name: name.trim(),
                manifest,
            });
            toast.success("Template created");
            router.push(
                `/${treasuryId}/custom-templates/${manifestIdOf(created.manifest)}`,
            );
        } catch (error) {
            toast.error(errorMessage(error));
        }
    }

    return (
        <PageComponentLayout
            title="New template"
            description="Author a proposal template from its manifest JSON."
            backButton
        >
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
                <PageCard className="gap-4">
                    <InputBlock title="Name" invalid={false}>
                        <LargeInput
                            borderless
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Recovery Mint"
                        />
                    </InputBlock>

                    <InputBlock
                        title="Manifest (JSON)"
                        invalid={errors.length > 0}
                    >
                        <Textarea
                            borderless
                            rows={16}
                            className="font-mono text-xs"
                            value={manifestText}
                            onChange={(event) =>
                                setManifestText(event.target.value)
                            }
                            placeholder={EXAMPLE}
                        />
                    </InputBlock>

                    {errors.length > 0 ? (
                        <ul className="list-disc pl-5 text-destructive text-sm">
                            {errors.map((message) => (
                                <li key={message}>{message}</li>
                            ))}
                        </ul>
                    ) : null}

                    <Button
                        type="button"
                        size="lg"
                        className="w-full"
                        disabled={!canSave}
                        onClick={handleSave}
                    >
                        {createTemplate.isPending
                            ? "Creating…"
                            : "Create template"}
                    </Button>
                </PageCard>
            </div>
        </PageComponentLayout>
    );
}
