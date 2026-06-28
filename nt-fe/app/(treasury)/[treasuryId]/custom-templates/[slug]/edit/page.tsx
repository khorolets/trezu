"use client";

/**
 * Edit or delete an existing template. Reuses TemplateEditor (Visual constructor by default, Code
 * tab for raw JSON) pre-filled with the template's current name + manifest, saving via the
 * `ChangePolicy`-gated update endpoint. Delete is confirmed in a dialog and returns to the index. A
 * non-author hitting save/delete gets the backend's 403 as a toast.
 */
import { useParams, useRouter } from "next/navigation";
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
import { apiErrorMessage } from "@/features/proposal-templates/api";
import { TemplateEditor } from "@/features/proposal-templates/components/template-editor";
import {
    useDeleteProposalTemplate,
    useUpdateProposalTemplate,
} from "@/features/proposal-templates/hooks/use-proposal-template-mutations";
import { useProposalTemplates } from "@/features/proposal-templates/hooks/use-proposal-templates";
import { manifestIdOf } from "@/features/proposal-templates/manifest";
import { useTreasury } from "@/hooks/use-treasury";

export default function EditTemplatePage() {
    const router = useRouter();
    const params = useParams();
    const slug = params?.slug as string | undefined;
    const { treasuryId } = useTreasury();
    const { data: templates, isLoading } = useProposalTemplates();
    const updateTemplate = useUpdateProposalTemplate();
    const deleteTemplate = useDeleteProposalTemplate();
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    const template = (templates ?? []).find(
        (candidate) => manifestIdOf(candidate.manifest) === slug,
    );

    async function handleUpdate({
        name,
        manifest,
    }: {
        name: string;
        manifest: unknown;
    }) {
        if (!template || !treasuryId) {
            return;
        }
        try {
            const updated = await updateTemplate.mutateAsync({
                id: template.id,
                input: { name, manifest },
            });
            toast.success("Template saved");
            router.push(
                `/${treasuryId}/custom-templates/${manifestIdOf(updated.manifest)}`,
            );
        } catch (error) {
            toast.error(apiErrorMessage(error, "Failed to save template"));
        }
    }

    async function handleDelete() {
        if (!template || !treasuryId) {
            return;
        }
        setConfirmingDelete(false);
        try {
            await deleteTemplate.mutateAsync(template.id);
            toast.success("Template deleted");
            router.push(`/${treasuryId}/custom-templates`);
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
                ) : template ? (
                    <TemplateEditor
                        key={template.id}
                        title="Edit Template"
                        onBack={() =>
                            router.push(`/${treasuryId}/custom-templates`)
                        }
                        initialName={template.name}
                        initialManifestText={JSON.stringify(
                            template.manifest,
                            null,
                            2,
                        )}
                        submitLabel="Save Changes"
                        submitting={updateTemplate.isPending}
                        onSubmit={handleUpdate}
                        footer={
                            <Button
                                type="button"
                                variant="ghost"
                                className="w-full text-destructive hover:text-destructive"
                                disabled={
                                    updateTemplate.isPending ||
                                    deleteTemplate.isPending
                                }
                                onClick={() => setConfirmingDelete(true)}
                            >
                                Delete Template
                            </Button>
                        }
                    />
                ) : (
                    <PageCard>
                        <p className="text-muted-foreground text-sm">
                            Template not found.
                        </p>
                    </PageCard>
                )}
            </div>

            <Dialog
                open={confirmingDelete}
                onOpenChange={(open) => !open && setConfirmingDelete(false)}
            >
                <DialogContent className="max-w-md gap-4">
                    <DialogHeader>
                        <DialogTitle>Delete template</DialogTitle>
                    </DialogHeader>
                    <DialogDescription>
                        Delete{" "}
                        <span className="font-semibold">{template?.name}</span>?
                        Members will no longer be able to file proposals from
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
