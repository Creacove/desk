import { Button } from "../../design-system/desktopPrimitives";
import type { TeamResponsibilities } from "../../types/workspaceTeam";
import { TeamRolePicker } from "./TeamRolePicker";

export type MemberResponsibilitiesDraft = TeamResponsibilities;

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
  onChange: (value: MemberResponsibilitiesDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-4 rounded-[14px] border border-foreground/8 bg-foreground/[0.018] p-3.5 sm:p-4">
      <TeamRolePicker
        value={draft}
        onChange={onChange}
        disabled={pending}
        titleLabel={`Role for ${memberName}`}
        responsibilitiesLabel={`Responsibilities for ${memberName}`}
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" pending={pending} onClick={onSave} aria-label={`Save responsibilities for ${memberName}`}>
          Save responsibilities
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
