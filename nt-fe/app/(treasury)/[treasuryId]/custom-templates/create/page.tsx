"use client";

/**
 * Author a new proposal template (code mode): the shared TemplateEditor validates the manifest JSON
 * live, then saves via the `ChangePolicy`-gated create endpoint. Lives at the reserved `create`
 * slug. A visual constructor is a planned follow-up — this is the code half.
 */
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageComponentLayout } from "@/components/page-component-layout";
import { apiErrorMessage } from "@/features/proposal-templates/api";
import { TemplateEditor } from "@/features/proposal-templates/components/template-editor";
import { useCreateProposalTemplate } from "@/features/proposal-templates/hooks/use-proposal-template-mutations";
import { manifestIdOf } from "@/features/proposal-templates/manifest";
import { useTreasury } from "@/hooks/use-treasury";

export default function CreateTemplatePage() {
    const router = useRouter();
    const { treasuryId } = useTreasury();
    const createTemplate = useCreateProposalTemplate();

    async function handleCreate({
        name,
        manifest,
    }: {
        name: string;
        manifest: unknown;
    }) {
        if (!treasuryId) {
            return;
        }
        try {
            const created = await createTemplate.mutateAsync({
                name,
                manifest,
            });
            toast.success("Template created");
            router.push(
                `/${treasuryId}/custom-templates/${manifestIdOf(created.manifest)}`,
            );
        } catch (error) {
            toast.error(apiErrorMessage(error, "Failed to create template"));
        }
    }

    return (
        <PageComponentLayout
            title="New template"
            description="Author a proposal template from its manifest JSON."
            backButton
        >
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
                <TemplateEditor
                    submitLabel="Create template"
                    submitting={createTemplate.isPending}
                    onSubmit={handleCreate}
                />
            </div>
        </PageComponentLayout>
    );
}
