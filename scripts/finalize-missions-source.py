from pathlib import Path
import subprocess

def swap(path, old, new, required=False):
    p=Path(path); text=p.read_text(); n=text.count(old)
    if required and n != 1: raise SystemExit(f"{path}: expected 1 match, found {n}: {old[:80]}")
    if n: p.write_text(text.replace(old,new))

subprocess.run(["git","fetch","origin","main","--depth=1"],check=True)
subprocess.run(["git","checkout","FETCH_HEAD","--","src/types/cleanProduction.ts"],check=True)

p="src/features/missions/MissionScreens.tsx"
swap(p,"  missionEvents,\n  missionNeedsUser,","  getNextArtistTask,\n  missionEvents,\n  missionNeedsUser,")
swap(p,'  const currentTask = mode === "todo" ? tasks.find((task) => !taskIsDone(task) && task.owner === "artist") : undefined;','  const currentTask = mode === "todo" ? getNextArtistTask(tasks, missionCheckpoints(mission), []) : undefined;')
for a,b in [
('{ value: "todo", label: "To do" },','{ id: "todo", label: "To do" },'),
('{ value: "progress", label: "In progress" },','{ id: "progress", label: "In progress" },'),
('{ value: "done", label: "Done" },','{ id: "done", label: "Done" },'),
('{ value: "work", label: "Work" },','{ id: "work", label: "Work" },'),
('{ value: "updates", label: "Updates" },','{ id: "updates", label: "Updates" },')]: swap(p,a,b,True)
swap(p,'        id: `event-${event.id || event.type}-${index}`','        id: `event-${(event as { id?: string }).id || event.type}-${index}`')

swap("src/features/missions/MissionWorkSurface.tsx",'  return (\n    <div className="grid min-w-0 gap-2">','  if (!checkpoints.length) {\n    return <p className="border-t border-foreground/8 py-8 text-[13px] font-medium text-muted-foreground">No work yet</p>;\n  }\n\n  return (\n    <div className="grid min-w-0 gap-2">')
swap("src/features/missions/MissionTaskSheet.tsx",'              <p className="text-[13px] font-bold text-foreground">In progress</p>\n              <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-muted-foreground">The team is working on this.</p>','              <p className="text-[13px] font-bold text-foreground">In progress</p>')
swap("src/app/ProductionApp.tsx",'  const showMobileTabbar = view !== "conversationWorkspace" && view !== "investigation" && view !== "decisionPackage" && !(view === "musicWorkspace" && musicDetailOpen);','  const showMobileTabbar = view !== "conversationWorkspace" && view !== "investigation" && view !== "decisionPackage" && !(view === "musicWorkspace" && musicDetailOpen) && !(view === "missionsWorkspace" && missionRoomOpen);',True)
print("Mission source finalized")
