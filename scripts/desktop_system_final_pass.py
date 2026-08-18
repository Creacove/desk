from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, value: str) -> None:
    Path(path).write_text(value, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    value = read(path)
    if old not in value:
        raise RuntimeError(f"Expected source block not found in {path}: {old[:120]!r}")
    write(path, value.replace(old, new, 1))


def replace_all(path: str, old: str, new: str, *, require: bool = True) -> None:
    value = read(path)
    if require and old not in value:
        raise RuntimeError(f"Expected text not found in {path}: {old!r}")
    write(path, value.replace(old, new))


# 1. Mission updates must carry the timestamps already selected from Supabase.
replace_once(
    "src/types/cleanProduction.ts",
    '''export type MissionNoteViewModel = {
  id: string;
  route: string;
  subject: string;
  message: string;
  status: string;
  sourceBasis: string;
  recommendedAction: string;
  resultingChange: string;
  briefType: string;
};''',
    '''export type MissionNoteViewModel = {
  id: string;
  route: string;
  subject: string;
  message: string;
  status: string;
  sourceBasis: string;
  recommendedAction: string;
  resultingChange: string;
  briefType: string;
  createdAt?: string;
};''',
)
replace_once(
    "src/types/cleanProduction.ts",
    '''export type MissionEventViewModel = {
  type: string;
  actor: string;
  summary: string;
};''',
    '''export type MissionEventViewModel = {
  type: string;
  actor: string;
  summary: string;
  createdAt?: string;
};''',
)

replace_once(
    "src/services/productionSupabase.ts",
    '''  const mappedEvents: MissionEventViewModel[] = operatingEvents.map((e) => ({
    type: e.event_type ?? "mission_change",
    actor: e.actor_type === "manager" ? "Manager" : e.actor_type === "user" ? "Artist" : "System",
    summary: e.summary ?? "Operating event recorded.",
  }));''',
    '''  const mappedEvents: MissionEventViewModel[] = operatingEvents.map((e) => ({
    type: e.event_type ?? "mission_change",
    actor: e.actor_type === "manager" ? "Manager" : e.actor_type === "user" ? "Artist" : "System",
    summary: e.summary ?? "Operating event recorded.",
    createdAt: e.created_at ?? undefined,
  }));''',
)
replace_once(
    "src/services/productionSupabase.ts",
    '''    resultingChange: m.reason ?? "Memory recorded",
    briefType: "Manager note",
  }));''',
    '''    resultingChange: m.reason ?? "Memory recorded",
    briefType: "Manager note",
    createdAt: m.created_at ?? undefined,
  }));''',
)

# 2. Mission navigation owns an explicit detail loading signal in addition to the
# local immediate pending shell used by MissionScreens.
replace_once(
    "src/app/ProductionApp.tsx",
    '''                missions={missions}
                selectedMissionId={selectedMissionId}''',
    '''                missions={missions}
                detailPending={missionDetailPending}
                selectedMissionId={selectedMissionId}''',
)

# 3. The Catalog/Song Room must describe Manager as a working surface rather than chat/Q&A.
music_path = "src/features/music/MusicScreens.tsx"
music = read(music_path)
for old, new in (
    ("Chat with Manager", "Work with Manager"),
    ("Continue with Manager", "Work with Manager"),
    ("Ask Manager", "Work with Manager"),
):
    music = music.replace(old, new)

# Desktop detail titles cap at the product detail scale instead of becoming a marketing hero.
old_title_class = 'font-display text-[40px] font-semibold leading-[0.95] tracking-[-0.04em] text-foreground xl:text-[48px]'
new_title_class = 'font-display text-[36px] font-semibold leading-[1.02] tracking-[-0.035em] text-foreground xl:text-[40px]'
if old_title_class not in music:
    raise RuntimeError("Song/Project desktop title class contract was not found")
music = music.replace(old_title_class, new_title_class, 1)

# Fix the invalid desktop Manager padding token and remove the floating marketing-CTA treatment.
old_manager_class = 'inline-flex h-11 shrink-0 items-center gap-2.5 self-center rounded-[12px] bg-brand-accent px-4.5 text-[12px] font-bold text-white shadow-[0_8px_24px_rgba(154,59,220,0.22)] transition-[opacity,transform] hover:-translate-y-px hover:opacity-92 focus:outline-none focus:ring-2 focus:ring-brand-accent/35'
new_manager_class = 'inline-flex h-11 shrink-0 items-center gap-2.5 self-center rounded-[11px] bg-brand-accent px-[18px] text-[13px] font-semibold text-white shadow-[0_1px_1px_hsl(var(--foreground)/0.06)] transition-[background-color,box-shadow] duration-150 hover:bg-brand-accent/92 focus:outline-none focus:ring-2 focus:ring-brand-accent/30'
if old_manager_class not in music:
    raise RuntimeError("Desktop Manager CTA class contract was not found")
music = music.replace(old_manager_class, new_manager_class, 1)

# The project review is a forward action, so it uses the same purple action language.
old_review_class = 'mt-4 inline-flex h-9 items-center gap-2 rounded-[10px] bg-foreground px-3.5 text-[11px] font-semibold text-background'
new_review_class = 'mt-4 inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-brand-accent px-4 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-brand-accent/92 focus:outline-none focus:ring-2 focus:ring-brand-accent/30'
if old_review_class not in music:
    raise RuntimeError("Project review primary action class contract was not found")
music = music.replace(old_review_class, new_review_class, 1)

# Keep direct micro-interactions explicit rather than transition-all.
music = music.replace(
    'transition-all group-hover:translate-x-0.5 group-hover:text-foreground/55',
    'transition-[transform,color] duration-150 group-hover:translate-x-0.5 group-hover:text-foreground/55',
)
write(music_path, music)

# Legacy Manager screens can still surface in compatibility paths; keep the product language coherent there too.
legacy_path = "src/features/manager/ManagerScreensLegacy.tsx"
legacy = read(legacy_path)
for old, new in (
    ("Chat with Manager", "Work with Manager"),
    ("Continue with Manager", "Work with Manager"),
    ("Ask Manager", "Work with Manager"),
):
    legacy = legacy.replace(old, new)
write(legacy_path, legacy)

# 4. Update source-level contracts that intentionally asserted the previous chat-like treatment.
replace_once(
    "src/song-room-manager-hierarchy.test.ts",
    '''  it("makes Chat with Manager the primary desktop CTA", () => {
    expect(source).toContain('aria-label="Chat with Manager"');
    expect(source).toContain('Chat with Manager\\n            </button>');
    expect(source).toContain('bg-brand-accent px-4.5 text-[12px] font-bold text-white');
  });''',
    '''  it("makes Work with Manager the primary desktop action", () => {
    expect(source).toContain('aria-label="Work with Manager"');
    expect(source).toContain('Work with Manager\\n            </button>');
    expect(source).toContain('bg-brand-accent px-[18px] text-[13px] font-semibold text-white');
  });''',
)
replace_once(
    "src/song-room-manager-hierarchy.test.ts",
    '''    expect(source).toContain('text-[40px] font-semibold leading-[0.95]');
    expect(source).toContain('xl:text-[48px]');''',
    '''    expect(source).toContain('text-[36px] font-semibold leading-[1.02]');
    expect(source).toContain('xl:text-[40px]');
    expect(source).not.toContain('xl:text-[48px]');''',
)
replace_once(
    "src/song-room-red-antler-overview.test.ts",
    '''  it("keeps Manager conversational in the header while Overview leads with record value", () => {
    expect(music).toContain('Chat with Manager');''',
    '''  it("keeps Manager as a work action in the header while Overview leads with record value", () => {
    expect(music).toContain('Work with Manager');
    expect(music).not.toContain('Chat with Manager');''',
)

# 5. Extend the desktop contract to guard the timestamp data path, not only presentation.
contract_path = "src/desktop-finish-contract.test.ts"
contract = read(contract_path)
marker = '''  it("never presents unresolved Activity or Evidence as empty", () => {'''
insert = '''  it("preserves real Mission update timestamps from the repository", () => {
    const types = read("types/cleanProduction.ts");
    const repository = read("services/productionSupabase.ts");
    expect(types).toContain("createdAt?: string");
    expect(repository).toContain("createdAt: e.created_at ?? undefined");
    expect(repository).toContain("createdAt: m.created_at ?? undefined");
  });

'''
if marker not in contract:
    raise RuntimeError("Desktop contract insertion marker was not found")
contract = contract.replace(marker, insert + marker, 1)
write(contract_path, contract)

print("Desktop final-pass source patches applied.")
