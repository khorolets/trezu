"use client";

/**
 * Index for the "Custom" section: lists a DAO's enabled proposal templates, each linking to its
 * per-template page (`/<dao>/custom-templates/<slug>`). The same templates appear in the sidebar;
 * this is the section's landing / overview.
 */
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageCard } from "@/components/card";
import { PageComponentLayout } from "@/components/page-component-layout";
import { useProposalTemplates } from "@/features/proposal-templates/hooks/use-proposal-templates";
import { manifestIdOf } from "@/features/proposal-templates/manifest";
import { useTreasury } from "@/hooks/use-treasury";

export default function CustomTemplatesIndexPage() {
    const router = useRouter();
    const { treasuryId } = useTreasury();
    const { data: templates, isLoading } = useProposalTemplates();

    const enabled = (templates ?? []).filter(
        (template) => template.enabled && manifestIdOf(template.manifest),
    );

    return (
        <PageComponentLayout
            title="Custom"
            description="Per-DAO proposal templates."
        >
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
                <div className="flex justify-end">
                    <div className="inline-flex items-center rounded-lg border bg-card p-1 shadow-sm">
                        <button
                            type="button"
                            onClick={() =>
                                router.push(
                                    `/${treasuryId}/custom-templates/create`,
                                )
                            }
                            className="flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-1 font-medium text-primary-foreground text-sm transition-all hover:bg-primary/90"
                        >
                            <Plus className="size-4" />
                            New template
                        </button>
                    </div>
                </div>
                {isLoading ? (
                    <PageCard>
                        <p className="text-muted-foreground text-sm">
                            Loading…
                        </p>
                    </PageCard>
                ) : enabled.length === 0 ? (
                    <PageCard>
                        <p className="text-muted-foreground text-sm">
                            No templates yet for this treasury.
                        </p>
                    </PageCard>
                ) : (
                    <PageCard className="gap-2">
                        {enabled.map((template) => (
                            <Link
                                key={template.id}
                                href={`/${treasuryId}/custom-templates/${manifestIdOf(template.manifest)}`}
                                className="flex flex-col rounded-xl bg-muted px-3.5 py-3 transition-colors hover:bg-general-tertiary"
                            >
                                <span className="font-medium text-sm">
                                    {template.name}
                                </span>
                                {template.description ? (
                                    <span className="text-muted-foreground text-xs">
                                        {template.description}
                                    </span>
                                ) : null}
                            </Link>
                        ))}
                    </PageCard>
                )}
            </div>
        </PageComponentLayout>
    );
}
