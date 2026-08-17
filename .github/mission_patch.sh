#!/usr/bin/env bash
set -euo pipefail
python - <<'PY'
from pathlib import Path

work = Path("src/features/missions/MissionWorkSurface.tsx")
text = work.read_text()
old = '''      const uploaded = onUploadTaskDeliverable
        ? await onUploadTaskDeliverable(task.id, { title: deliverable.title, file })
        : {
            ...deliverable,
            status: "uploaded" as const,
            documentId: `local-${task.id}-${Date.now()}`,
            fileName: file.name,
            validationSummary: "Ready for Manager review.",
          };'''
new = '''      if (!onUploadTaskDeliverable) {
        throw new Error("Evidence upload is unavailable. The file was not saved.");
      }
      const uploaded = await onUploadTaskDeliverable(task.id, { title: deliverable.title, file });'''
if old not in text:
    raise SystemExit("Expected fake evidence fallback not found")
work.write_text(text.replace(old, new, 1))

test = Path("src/mission-task-deliverables.test.tsx")
text = test.read_text()
first_marker = '  it("passes an optional uploaded document into completion when supplied", async () => {'
regression = '''  it("never fabricates evidence when upload persistence is unavailable", async () => {
    const onCompleteTask = vi.fn(async () => undefined);
    renderMission(missionWithThesis(), { onCompleteTask, openTaskId: "task-thesis" });

    const dialog = screen.getByRole("dialog", { name: "Provide 90-day thesis" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Upload" }));
    fireEvent.change(within(dialog).getByLabelText("Upload optional context for Provide 90-day thesis"), {
      target: { files: [new File(["positioning"], "thesis.pdf", { type: "application/pdf" })] },
    });

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Evidence upload is unavailable. The file was not saved.");
    expect(within(dialog).getByText("thesis.pdf")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Upload" })).toBeEnabled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Mark complete" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark complete" }));
    await waitFor(() => expect(onCompleteTask).toHaveBeenCalledWith("task-thesis", "completed", "", [], undefined));
  });

'''
if first_marker not in text:
    raise SystemExit("Upload test insertion point missing")
if "never fabricates evidence when upload persistence is unavailable" not in text:
    text = text.replace(first_marker, regression + first_marker, 1)

upload_change = '''    fireEvent.change(screen.getByLabelText("Upload optional context for Provide 90-day thesis"), {
      target: { files: [new File(["positioning"], "thesis.pdf", { type: "application/pdf" })] },
    });'''
upload_replacement = '''    const dialog = screen.getByRole("dialog", { name: "Provide 90-day thesis" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Upload" }));
    fireEvent.change(within(dialog).getByLabelText("Upload optional context for Provide 90-day thesis"), {
      target: { files: [new File(["positioning"], "thesis.pdf", { type: "application/pdf" })] },
    });'''
if upload_change not in text:
    raise SystemExit("Successful upload interaction missing")
text = text.replace(upload_change, upload_replacement, 1)

dupe_dialog = '''    const dialog = screen.getByRole("dialog", { name: "Provide 90-day thesis" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark complete" }));'''
text = text.replace(dupe_dialog, '    fireEvent.click(within(dialog).getByRole("button", { name: "Mark complete" }));', 1)

manager_click = '    fireEvent.click(screen.getByRole("button", { name: "Work with Manager" }));'
manager_scoped = '''    const dialog = screen.getByRole("dialog", { name: "Provide 90-day thesis" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Work with Manager" }));'''
if manager_click not in text:
    raise SystemExit("Manager click assertion missing")
text = text.replace(manager_click, manager_scoped, 1)

old_name = 'it("closes Manager review submission immediately and shows pending state on the task", async () => {'
new_name = 'it("keeps Manager review pending until persisted checkpoint state clears it", async () => {'
if old_name not in text:
    raise SystemExit("Review test name missing")
text = text.replace(old_name, new_name, 1)
old_tail = '''    resolveReview?.();
    await waitFor(() => expect(screen.queryByText("Manager reviewing")).not.toBeInTheDocument());'''
new_tail = '''    resolveReview?.();
    await waitFor(() => expect(onCompleteTask).toHaveResolved());
    expect(screen.getByText("Manager reviewing")).toBeInTheDocument();'''
if old_tail not in text:
    raise SystemExit("Obsolete review assertion missing")
text = text.replace(old_tail, new_tail, 1)
test.write_text(text)
PY

rm .github/workflows/mission-release-gate-patch.yml .github/mission_patch.sh
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git add src/features/missions/MissionWorkSurface.tsx src/mission-task-deliverables.test.tsx .github/workflows/mission-release-gate-patch.yml .github/mission_patch.sh
git commit -m 'Harden mission evidence persistence'
git push origin HEAD:design/mission-workspace-simplification
