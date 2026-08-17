from pathlib import Path
import subprocess

def swap(path, old, new, required=False):
    p=Path(path); text=p.read_text(); n=text.count(old)
    if required and n != 1: raise SystemExit(f"{path}: expected 1 match, found {n}: {old[:80]}")
    if n: p.write_text(text.replace(old,new))

# Restore the exact production shared-type contract.
subprocess.run(["git","fetch","origin","main","--depth=1"],check=True)
subprocess.run(["git","checkout","FETCH_HEAD","--","src/types/cleanProduction.ts"],check=True)

# Keep the redesign compatible with the production WorkspaceTabRail API.
p="src/features/missions/MissionScreens.tsx"
for a,b in [
('{ value: "todo", label: "To do" },','{ id: "todo", label: "To do" },'),
('{ value: "progress", label: "In progress" },','{ id: "progress", label: "In progress" },'),
('{ value: "done", label: "Done" },','{ id: "done", label: "Done" },'),
('{ value: "work", label: "Work" },','{ id: "work", label: "Work" },'),
('{ value: "updates", label: "Updates" },','{ id: "updates", label: "Updates" },')]: swap(p,a,b,True)
swap(p,'        id: `event-${event.id || event.type}-${index}`','        id: `event-${(event as { id?: string }).id || event.type}-${index}`')

# Match Song Room: hide the mobile bottom menu while inside Mission Room.
swap("src/app/ProductionApp.tsx",'  const showMobileTabbar = view !== "conversationWorkspace" && view !== "investigation" && view !== "decisionPackage" && !(view === "musicWorkspace" && musicDetailOpen);','  const showMobileTabbar = view !== "conversationWorkspace" && view !== "investigation" && view !== "decisionPackage" && !(view === "musicWorkspace" && musicDetailOpen) && !(view === "missionsWorkspace" && missionRoomOpen);',True)
print("Mission source finalized")
