"use client";

/**
 * Per-template page: `/<dao>/custom-templates/<slug>` where `<slug>` is the manifest id. Resolves
 * the template, renders its manifest as a form (`<ManifestForm>`), and on submit builds the
 * FunctionCall (`buildTemplateProposal`) and files it via the house `createProposal` helper — the
 * same gasless-relayer route the core proposals use, so a custom request behaves like a built-in one.
 */
import { ArrowLeft } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PageCard } from "@/components/card";
import { PageComponentLayout } from "@/components/page-component-layout";
import {
    buildTemplateProposal,
    type FieldValues,
} from "@/features/proposal-templates/build-proposal";
import { ManifestForm } from "@/features/proposal-templates/components/manifest-form";
import { useProposalTemplates } from "@/features/proposal-templates/hooks/use-proposal-templates";
import {
    manifestErrorMessages,
    manifestIdOf,
    parseManifest,
} from "@/features/proposal-templates/manifest";
import { useTreasury } from "@/hooks/use-treasury";
import { useTreasuryPolicy } from "@/hooks/use-treasury-queries";
import { useNear } from "@/stores/near-store";

export default function CustomTemplatePage() {
    const params = useParams();
    const router = useRouter();
    const slug = params?.slug as string | undefined;
    const { treasuryId } = useTreasury();
    // accountId is non-null only when fully authenticated (connected + auth + terms accepted).
    // Files through the house `createProposal` helper — the same gasless-relayer path the core
    // proposals (payments, exchange, members…) use: it signs the `add_proposal` delegate action,
    // relays it via the backend, waits for the indexer, invalidates the requests list, and shows the
    // rich "View request" toast. So a custom request behaves exactly like a built-in one.
    const { accountId, createProposal } = useNear();
    const { data: policy } = useTreasuryPolicy(treasuryId);
    const { data: templates, isLoading } = useProposalTemplates();
    const [submitting, setSubmitting] = useState(false);

    const template = templates?.find(
        (candidate) => manifestIdOf(candidate.manifest) === slug,
    );
    const parsed = template ? parseManifest(template.manifest) : null;

    // Throws on failure (and on a missing session) so ManifestForm only resets the form on success.
    // `createProposal` already toasts its own relayer errors, so we just re-throw here.
    async function handleSubmit(values: FieldValues) {
        if (!parsed?.success || !treasuryId) {
            return;
        }
        if (!accountId) {
            toast.error("Sign in and accept the terms to file a proposal");
            throw new Error("not authenticated");
        }
        setSubmitting(true);
        try {
            const { kind, description } = buildTemplateProposal(
                parsed.data,
                values,
            );
            await createProposal("Request filed", {
                treasuryId,
                proposal: { description, kind },
                proposalBond: policy?.proposal_bond ?? "0",
                proposalType: "other",
            });
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <PageComponentLayout
            title="Request Templates"
            description="Build reusable templates for custom request types."
        >
            <div className="mx-auto flex w-full max-w-[600px] flex-col gap-4">
                {isLoading ? (
                    <PageCard>
                        <p className="text-muted-foreground text-sm">
                            Loading…
                        </p>
                    </PageCard>
                ) : !template ? (
                    <PageCard>
                        <p className="text-muted-foreground text-sm">
                            No template found for &ldquo;{slug}&rdquo;.
                        </p>
                    </PageCard>
                ) : parsed && !parsed.success ? (
                    <PageCard>
                        <div className="text-destructive text-sm">
                            <p>This template&apos;s manifest is invalid:</p>
                            <ul className="list-disc pl-5">
                                {manifestErrorMessages(parsed.error).map(
                                    (message) => (
                                        <li key={message}>{message}</li>
                                    ),
                                )}
                            </ul>
                        </div>
                    </PageCard>
                ) : parsed?.success ? (
                    <PageCard className="gap-4">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() =>
                                    router.push(
                                        `/${treasuryId}/custom-templates`,
                                    )
                                }
                                aria-label="Back"
                                className="text-muted-foreground transition-colors hover:text-foreground"
                            >
                                <ArrowLeft className="size-5" />
                            </button>
                            <h2 className="font-semibold text-base">
                                {parsed.data.title}
                            </h2>
                        </div>
                        {parsed.data.description ? (
                            <p className="text-muted-foreground text-sm">
                                {parsed.data.description}
                            </p>
                        ) : null}
                        <ManifestForm
                            manifest={parsed.data}
                            onSubmit={handleSubmit}
                            submitting={submitting}
                        />
                    </PageCard>
                ) : null}
            </div>
        </PageComponentLayout>
    );
}
