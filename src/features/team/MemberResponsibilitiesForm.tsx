import { Field } from "../../design-system/components";
import { Button } from "../../design-system/desktopPrimitives";

export type MemberResponsibilitiesDraft = {
  operatingTitle: string;
  responsibilityTags: string;
};

export function MemberResponsibilitiesForm({
  memberName,
  draft,
  pending,
  onChange,
  onSave,
  onCancel,
}: {
  memberName: string;
  draft: MemberResponsibilitiesDraft;
  pending?: boolean;
  onChange: (field: keyof MemberResponsibilitiesDraft, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-4 rounded-[14px] border border-foreground/8 bg-foreground/[0.018] p-3.5 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={`Operating title for ${memberName}`}
          value={draft.operatingTitle}
          onChange={(value) => onChange("operatingTitle", value)}
          disabled={pending}
        />
        <Field
          label={`Responsibility tags for ${memberName}`}
          value={draft.responsibilityTags}
          onChange={(value) => onChange("responsibilityTags", value)}
          helper="Comma separated · up to 12 tags"
          disabled={pending}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" pending={pending} onClick={onSave} aria-label={`Save responsibilities for ${memberName}`}>
          Save responsibilities
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
        <span className="text-[11px] font-medium text-muted-foreground">Title up to 80 characters · tags up to 48 characters each</span>
      </div>
    </div>
  );
}
