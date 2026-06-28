"use client";

/**
 * Index for the Request Templates section: the empty state (no templates yet) or the Templates list.
 * Each row links to its fill page ("Create Request") and carries a ⋮ menu — Edit, Pin/Unpin (the
 * pin controls whether it shows in the sidebar), Delete (confirmed). Authoring/pin/delete are
 * ChangePolicy-gated server-side; a non-author gets the backend's 403 as a toast.
 */
import {
    Bookmark,
    CircleHelp,
    EllipsisVertical,
    Pencil,
    Pin,
    PinOff,
    Plus,
    Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/button";
import { PageCard } from "@/components/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/modal";
import { PageComponentLayout } from "@/components/page-component-layout";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiErrorMessage } from "@/features/proposal-templates/api";
import {
    useDeleteProposalTemplate,
    useUpdateProposalTemplate,
} from "@/features/proposal-templates/hooks/use-proposal-template-mutations";
import { useProposalTemplates } from "@/features/proposal-templates/hooks/use-proposal-templates";
import { manifestIdOf } from "@/features/proposal-templates/manifest";
import type { ProposalTemplate } from "@/features/proposal-templates/types";
import { useTreasury } from "@/hooks/use-treasury";

// Predicted official docs path; swap for the maintainers' docs-site URL once it exists.
const HOW_IT_WORKS_URL =
    "https://github.com/NEAR-DevHub/trezu/blob/main/docs/CUSTOM_PROPOSAL_TEMPLATES.md";

// The bare shadcn dropdown item is px-2 py-1.5 with no icon gap; the design wants 10×12 padding and
// a 12px icon-to-label gap, so the ⋮ menu items share this. Delete is a plain item (not red).
const MENU_ITEM_CLASS = "gap-3 px-3 py-2.5";

function HowItWorksLink() {
    return (
        <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            asChild
        >
            <a href={HOW_IT_WORKS_URL} target="_blank" rel="noreferrer">
                <CircleHelp className="size-4" /> How It Works
            </a>
        </Button>
    );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
    return (
        <PageCard className="items-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Bookmark className="size-5" />
            </div>
            <div className="flex flex-col gap-1">
                <h2 className="font-semibold text-base">
                    Create your first template
                </h2>
                <p className="max-w-sm text-muted-foreground text-sm">
                    Make a template for requests you send often. Your team
                    reuses it in one click.
                </p>
            </div>
            <div className="flex items-center gap-2">
                <HowItWorksLink />
                <Button onClick={onCreate}>
                    <Plus className="size-4" /> Create Template
                </Button>
            </div>
        </PageCard>
    );
}

interface TemplateRowProps {
    template: ProposalTemplate;
    onCreateRequest: () => void;
    onEdit: () => void;
    onTogglePin: () => void;
    onDelete: () => void;
}

function TemplateRow({
    template,
    onCreateRequest,
    onEdit,
    onTogglePin,
    onDelete,
}: TemplateRowProps) {
    return (
        <div className="group flex min-h-[75px] items-center justify-between gap-3 rounded-xl bg-[#FAFAF9] p-4 dark:bg-muted">
            <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate font-semibold text-[15px] text-foreground">
                    {template.name}
                </span>
                {template.description ? (
                    <span className="truncate text-[12px] text-muted-foreground">
                        {template.description}
                    </span>
                ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Template actions"
                            className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                        >
                            <EllipsisVertical className="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem
                            onClick={onEdit}
                            className={MENU_ITEM_CLASS}
                        >
                            <Pencil className="size-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={onTogglePin}
                            className={MENU_ITEM_CLASS}
                        >
                            {template.pinned ? (
                                <>
                                    <PinOff className="size-4" /> Unpin Template
                                </>
                            ) : (
                                <>
                                    <Pin className="size-4" /> Pin to the
                                    Sidebar
                                </>
                            )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={onDelete}
                            className={MENU_ITEM_CLASS}
                        >
                            <Trash2 className="size-4" /> Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <Button onClick={onCreateRequest}>Create Request</Button>
            </div>
        </div>
    );
}

export default function CustomTemplatesIndexPage() {
    const router = useRouter();
    const { treasuryId } = useTreasury();
    const { data: templates, isLoading } = useProposalTemplates();
    const updateTemplate = useUpdateProposalTemplate();
    const deleteTemplate = useDeleteProposalTemplate();
    const [confirmingDelete, setConfirmingDelete] =
        useState<ProposalTemplate | null>(null);

    const enabled = (templates ?? []).filter(
        (template) => template.enabled && manifestIdOf(template.manifest),
    );

    const go = (suffix: string) =>
        router.push(`/${treasuryId}/custom-templates${suffix}`);

    function togglePin(template: ProposalTemplate) {
        updateTemplate.mutate(
            { id: template.id, input: { pinned: !template.pinned } },
            {
                onError: (error) =>
                    toast.error(apiErrorMessage(error, "Could not update pin")),
            },
        );
    }

    async function handleDelete() {
        const template = confirmingDelete;
        if (!template) {
            return;
        }
        setConfirmingDelete(null);
        try {
            await deleteTemplate.mutateAsync(template.id);
            toast.success("Template deleted");
        } catch (error) {
            toast.error(apiErrorMessage(error, "Failed to delete template"));
        }
    }

    return (
        <PageComponentLayout
            title="Request Templates"
            description="Build reusable templates for custom request types."
        >
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
                {isLoading ? (
                    <PageCard>
                        <p className="text-muted-foreground text-sm">
                            Loading…
                        </p>
                    </PageCard>
                ) : enabled.length === 0 ? (
                    <EmptyState onCreate={() => go("/create")} />
                ) : (
                    <PageCard className="gap-4 p-5">
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="font-semibold text-base">
                                Templates
                            </h2>
                            <div className="flex items-center gap-2">
                                <HowItWorksLink />
                                <Button
                                    variant="secondary"
                                    onClick={() => go("/create")}
                                >
                                    <Plus className="size-4" /> Add New
                                </Button>
                            </div>
                        </div>
                        <div className="flex flex-col gap-3">
                            {enabled.map((template) => (
                                <TemplateRow
                                    key={template.id}
                                    template={template}
                                    onCreateRequest={() =>
                                        go(
                                            `/${manifestIdOf(template.manifest)}`,
                                        )
                                    }
                                    onEdit={() =>
                                        go(
                                            `/${manifestIdOf(template.manifest)}/edit`,
                                        )
                                    }
                                    onTogglePin={() => togglePin(template)}
                                    onDelete={() =>
                                        setConfirmingDelete(template)
                                    }
                                />
                            ))}
                        </div>
                    </PageCard>
                )}
            </div>

            <Dialog
                open={confirmingDelete !== null}
                onOpenChange={(open) => !open && setConfirmingDelete(null)}
            >
                <DialogContent className="max-w-md gap-4">
                    <DialogHeader>
                        <DialogTitle>Delete template</DialogTitle>
                    </DialogHeader>
                    <DialogDescription>
                        Delete{" "}
                        <span className="font-semibold">
                            {confirmingDelete?.name}
                        </span>
                        ? Members will no longer be able to file proposals from
                        it. This cannot be undone.
                    </DialogDescription>
                    <DialogFooter>
                        <Button
                            variant="destructive"
                            className="flex-1"
                            disabled={deleteTemplate.isPending}
                            onClick={handleDelete}
                        >
                            {deleteTemplate.isPending ? "Deleting…" : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageComponentLayout>
    );
}
