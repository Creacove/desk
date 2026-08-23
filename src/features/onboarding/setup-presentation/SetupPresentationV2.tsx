import type { SetupPresentationSnapshot } from "../../../types/setupPresentation";
import ManagerWorkingFile from "./ManagerWorkingFile";

type SetupPresentationV2Props = {
  snapshot: SetupPresentationSnapshot;
};

export default function SetupPresentationV2({ snapshot }: SetupPresentationV2Props) {
  return (
    <div data-testid="setup-presentation-v2">
      <ManagerWorkingFile snapshot={snapshot} />
    </div>
  );
}
