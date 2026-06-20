"use client";

/**
 * Per-template page: `/<dao>/custom-templates/<slug>` where `<slug>` is the manifest id. Resolves
 * the template, renders its manifest as a form (`<ManifestForm>`), and on submit builds the
 * FunctionCall (`buildTemplateProposal`) and files it by signing `add_proposal` with the connected
 * wallet (the proposer pays gas; bond is 0). Production can swap this for the gasless relayer.
 */
import { useParams } from "next/navigation";
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
import { useNearStore } from "@/stores/near-store";

export default function CustomTemplatePage() {
    const params = useParams();
    const slug = params?.slug as string | undefined;
    const { treasuryId } = useTreasury();
    const connector = useNearStore((state) => state.connector);
    const { data: policy } = useTreasuryPolicy(treasuryId);
    const { data: templates, isLoading } = useProposalTemplates();
    const [submitting, setSubmitting] = useState(false);

    const template = templates?.find(
        (candidate) => manifestIdOf(candidate.manifest) === slug,
    );
    const parsed = template ? parseManifest(template.manifest) : null;

    async function handleSubmit(values: FieldValues) {
        if (!parsed?.success || !treasuryId) {
            return;
        }
        if (!connector) {
            toast.error("Connect your wallet first");
            return;
        }
        setSubmitting(true);
        try {
            const { kind, description } = buildTemplateProposal(
                parsed.data,
                values,
            );
            const wallet = await connector.wallet();
            await wallet.signAndSendTransaction({
                receiverId: treasuryId,
                actions: [
                    {
                        type: "FunctionCall",
                        params: {
                            methodName: "add_proposal",
                            args: { proposal: { description, kind } },
                            gas: "270000000000000",
                            deposit: policy?.proposal_bond ?? "0",
                        },
                    },
                ],
            });
            toast.success("Proposal filed");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to file proposal",
            );
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <PageComponentLayout
            title={parsed?.success ? parsed.data.title : "Template"}
            description="Fill the template to file a proposal."
            backButton
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
                    <PageCard>
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
