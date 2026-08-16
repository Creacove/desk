from pathlib import Path
import re

MUSIC = Path('src/features/music/MusicScreens.tsx')
text = MUSIC.read_text()

def replace_once(old: str, new: str, label: str):
    global text
    if old not in text:
        raise SystemExit(f'missing anchor: {label}')
    text = text.replace(old, new, 1)

# FILES — flatten the page into the same editorial rhythm as Overview while keeping all actions.
replace_once(
'''      {effectiveTab === "files" ? (\n        <div className="surface-elevated overflow-hidden rounded-[22px] shadow-sm">''',
'''      {effectiveTab === "files" ? (\n        <div data-testid="song-room-files" className="mx-auto w-full max-w-4xl">''',
'files shell',
)
replace_once(
'''          <div className="flex flex-col gap-4 border-b border-foreground/8 px-4 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-5">''',
'''          <div className="flex flex-col gap-4 border-b border-foreground/8 pb-5 sm:flex-row sm:items-center sm:justify-between">''',
'files header',
)
replace_once(
'''              <h4 className="font-display text-[20px] font-semibold leading-tight text-foreground">Song assets</h4>\n              <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-muted-foreground/82">Everything your team needs for this song, in one place.</p>''',
'''              <h4 className="font-display text-[20px] font-semibold leading-tight tracking-[-0.01em] text-foreground sm:text-[22px]">Song assets</h4>\n              <p className="mt-1.5 text-[12px] font-medium leading-5 text-muted-foreground/78">Everything your team needs for this song, in one place.</p>''',
'files title scale',
)
replace_once(
'''          <div className="grid gap-7 px-4 py-5 sm:px-5 sm:py-6">\n            <section aria-labelledby="song-assets-audio">''',
'''          <div className="grid">\n            <section aria-labelledby="song-assets-audio" className="border-b border-foreground/8 py-5 sm:py-6">''',
'files sections',
)
replace_once(
'''            <section aria-labelledby="song-assets-documents">''',
'''            <section aria-labelledby="song-assets-documents" className="py-5 sm:py-6">''',
'documents section',
)

# Standardize section labels and reduce nested-card emphasis in Files.
text = text.replace('font-ui text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground', 'font-ui text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/70')
replace_once(
'''    <section className="relative" aria-labelledby={`song-assets-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>''',
'''    <section className="relative border-b border-foreground/8 py-5 sm:py-6" aria-labelledby={`song-assets-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>''',
'asset group section',
)
replace_once(
'''        <p className="rounded-[14px] border border-dashed border-foreground/10 px-4 py-3 text-[11px] font-medium text-muted-foreground/72">{emptyCopy}</p>''',
'''        <p className="py-2 text-[12px] font-medium leading-5 text-muted-foreground/68">{emptyCopy}</p>''',
'asset group empty state',
)
replace_once(
'''              ) : <p className="rounded-[14px] border border-dashed border-foreground/10 px-4 py-3 text-[11px] font-medium text-muted-foreground/72">Write lyrics and press materials here, ask Manager for a draft, or upload an existing file.</p>}''',
'''              ) : <p className="py-2 text-[12px] font-medium leading-5 text-muted-foreground/68">No documents yet.</p>}''',
'document empty state',
)

# Add quiet semantic glyphs to stored files so rows scan as objects, not prose.
replace_once(
'''function MusicStoredAssetRow({\n  asset,\n  onUploadAsset,\n}: {\n  asset: NonNullable<MusicObjectViewModel["fileAssets"]>[number];\n  onUploadAsset: (asset: NonNullable<MusicObjectViewModel["fileAssets"]>[number]) => void;\n}) {\n  return (\n    <div className="flex min-h-[52px] items-center gap-3 px-3.5 py-2.5 sm:px-4">\n      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{asset.label}</span>''',
'''function MusicStoredAssetRow({\n  asset,\n  onUploadAsset,\n}: {\n  asset: NonNullable<MusicObjectViewModel["fileAssets"]>[number];\n  onUploadAsset: (asset: NonNullable<MusicObjectViewModel["fileAssets"]>[number]) => void;\n}) {\n  const StoredAssetIcon = asset.group === "Artwork" ? ImageIcon : asset.group === "Documents" ? FileText : FileAudio;\n  return (\n    <div className="flex min-h-[56px] items-center gap-3 px-3.5 py-2.5 sm:px-4">\n      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-foreground/[0.05] text-muted-foreground"><StoredAssetIcon className="h-3.5 w-3.5" aria-hidden="true" /></span>\n      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">{asset.label}</span>''',
'stored asset row',
)

# DETAILS — same typography, spacing, border language on mobile and desktop; no dashboard shell.
details_pattern = re.compile(r'''      \{effectiveTab === "details" \? \(\n.*?\n      \{effectiveTab === "rights" \? \(''', re.S)
details_replacement = '''      {effectiveTab === "details" ? (\n        <div data-testid="song-room-details" className="mx-auto w-full max-w-4xl">\n          <div className="border-b border-foreground/8 pb-5">\n            <h4 className="font-display text-[20px] font-semibold leading-tight tracking-[-0.01em] text-foreground sm:text-[22px]">Song identity</h4>\n            <p className="mt-1.5 text-[12px] font-medium leading-5 text-muted-foreground/78">Core release information and metadata.</p>\n          </div>\n\n          <div data-testid="song-room-mobile-details" className="rounded-[16px] lg:hidden">\n            <div className="divide-y divide-foreground/8">\n              {detailGroups.map((group) => (\n                <section key={group.title} className="py-5">\n                  <p className="font-ui text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/70">{group.title}</p>\n                  <div className="mt-3 overflow-hidden rounded-[14px] border border-foreground/8 bg-background">\n                    <div className="divide-y divide-foreground/7">\n                      {group.fields.map((field) => (\n                        <div\n                          key={`${group.title}-mobile-${field.label}`}\n                          data-testid={mobileDetailFieldTestId(field.label)}\n                          className="grid min-h-[58px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-2.5"\n                        >\n                          <span className="min-w-0">\n                            <span className="block text-[11px] font-medium leading-4 text-muted-foreground/72">{field.label}</span>\n                            <span className={cn("mt-0.5 block truncate text-[13px] font-semibold leading-5", field.status === "Missing" ? "text-muted-foreground/58" : "text-foreground")}>{field.status === "Missing" ? "Not added" : field.value}</span>\n                          </span>\n                          {canEditDetailField(field) ? (\n                            <button type="button" aria-label={`Edit mobile ${field.label}`} title={`Edit ${field.label}`} onClick={() => onEditDetail(group.title, field)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.045] hover:text-foreground focus:outline-none focus:ring-2 focus:ring-brand-accent/25">\n                              <Pencil className="h-3.5 w-3.5" />\n                            </button>\n                          ) : null}\n                        </div>\n                      ))}\n                    </div>\n                  </div>\n                </section>\n              ))}\n            </div>\n          </div>\n\n          <div data-testid="song-room-desktop-details" className="hidden lg:block">\n            <div className="divide-y divide-foreground/8">\n              {detailGroups.map((group) => (\n                <section key={group.title} className="py-6">\n                  <p className="font-ui text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/70">{group.title}</p>\n                  <div className="mt-3 grid overflow-hidden rounded-[14px] border border-foreground/8 bg-background sm:grid-cols-2">\n                    {group.fields.map((field) => (\n                      <div key={`${group.title}-${field.label}`} className="flex min-h-[64px] items-center justify-between gap-4 border-t border-foreground/7 px-4 py-3 first:border-t-0 sm:[&:nth-child(-n+2)]:border-t-0 sm:[&:nth-child(odd)]:border-r">\n                        <span className="min-w-0">\n                          <span className="block text-[11px] font-medium leading-4 text-muted-foreground/72">{field.label}</span>\n                          <span className={cn("mt-0.5 block truncate text-[13px] font-semibold leading-5", field.status === "Missing" ? "text-muted-foreground/58" : "text-foreground")}>{field.status === "Missing" ? "Not added" : field.value}</span>\n                        </span>\n                        {canEditDetailField(field) ? (\n                          <button type="button" aria-label={`Edit ${field.label}`} title={`Edit ${field.label}`} onClick={() => onEditDetail(group.title, field)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.045] hover:text-foreground focus:outline-none focus:ring-2 focus:ring-brand-accent/25">\n                            <Pencil className="h-3.5 w-3.5" />\n                          </button>\n                        ) : null}\n                      </div>\n                    ))}\n                  </div>\n                </section>\n              ))}\n            </div>\n          </div>\n        </div>\n      ) : null}\n\n      {effectiveTab === "rights" ? ('''
text, count = details_pattern.subn(details_replacement, text, count=1)
if count != 1:
    raise SystemExit('details block not found')

# RIGHTS — remove the oversized explanatory card, shorten empty states, and make the ledger mobile-native.
replace_once(
'''  const ledgerColumns = locked\n    ? "grid-cols-[1.3fr_1fr_1.25fr_0.85fr_0.85fr_1.15fr]"\n    : "grid-cols-[1.3fr_1fr_1.25fr_0.85fr_0.85fr_1.1fr_44px]";''',
'''  const ledgerColumns = locked\n    ? "grid-cols-2 sm:grid-cols-[1.3fr_1fr_1.25fr_0.85fr_0.85fr_1.15fr]"\n    : "grid-cols-2 sm:grid-cols-[1.3fr_1fr_1.25fr_0.85fr_0.85fr_1.1fr_44px]";''',
'rights ledger columns',
)
replace_once(
'''    <div className="grid gap-4">\n      <span className="sr-only">split sheet document confirm split sheet publishing splits master share</span>\n      <div className="surface-elevated rounded-[22px] p-5 shadow-sm">''',
'''    <div data-testid="song-room-rights" className="mx-auto w-full max-w-4xl">\n      <span className="sr-only">split sheet document confirm split sheet publishing splits master share</span>\n      <div>''',
'rights shell',
)
replace_once(
'''        <div className="flex flex-col gap-3 border-b border-foreground/8 pb-4 sm:flex-row sm:items-start sm:justify-between">\n          <div className="max-w-3xl">\n            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Song rights</p>\n            <h4 className="mt-1 font-display text-[20px] font-bold leading-tight text-foreground">{rights.headline}</h4>\n            <p className="mt-2 text-[13px] font-semibold leading-relaxed text-muted-foreground/84">{rights.description}</p>\n          </div>''',
'''        <div className="flex flex-col gap-3 border-b border-foreground/8 pb-5 sm:flex-row sm:items-center sm:justify-between">\n          <div className="max-w-2xl">\n            <h4 className="font-display text-[20px] font-semibold leading-tight tracking-[-0.01em] text-foreground sm:text-[22px]">Song rights</h4>\n            {contributors.length ? <p className="mt-1.5 text-[12px] font-medium leading-5 text-muted-foreground/78">{rights.headline}</p> : null}\n          </div>''',
'rights header',
)
replace_once(
'''          <div className="mt-4 grid gap-2 rounded-[14px] bg-foreground/[0.025] p-3 sm:grid-cols-3">''',
'''          <div className="mt-5 grid gap-3 border-y border-foreground/8 py-4 sm:grid-cols-3 sm:gap-0">''',
'rights stats',
)
replace_once(
'''            <p className="text-[12px] font-semibold text-muted-foreground"><span className="block text-[10px] uppercase tracking-[0.08em]">Publishing allocated</span><strong className="mt-1 block text-[16px] text-foreground">{rights.publishingAllocated}%</strong></p>\n            <p className="text-[12px] font-semibold text-muted-foreground"><span className="block text-[10px] uppercase tracking-[0.08em]">Master allocated</span><strong className="mt-1 block text-[16px] text-foreground">{rights.masterAllocated}%</strong></p>\n            {confirmationActive ? <p className="text-[12px] font-semibold text-muted-foreground"><span className="block text-[10px] uppercase tracking-[0.08em]">Confirmed</span><strong className="mt-1 block text-[16px] text-foreground">{rights.confirmedCount} of {rights.contributorCount}</strong></p> : null}''',
'''            <p className="text-[11px] font-medium text-muted-foreground sm:border-r sm:border-foreground/8 sm:px-4 sm:first:pl-0"><span className="block">Publishing</span><strong className="mt-1 block text-[15px] font-semibold text-foreground">{rights.publishingAllocated}%</strong></p>\n            <p className="text-[11px] font-medium text-muted-foreground sm:border-r sm:border-foreground/8 sm:px-4"><span className="block">Master</span><strong className="mt-1 block text-[15px] font-semibold text-foreground">{rights.masterAllocated}%</strong></p>\n            {confirmationActive ? <p className="text-[11px] font-medium text-muted-foreground sm:px-4"><span className="block">Confirmed</span><strong className="mt-1 block text-[15px] font-semibold text-foreground">{rights.confirmedCount} of {rights.contributorCount}</strong></p> : null}''',
'rights stats typography',
)
replace_once(
'''        {!contributors.length ? (\n          <div className="mt-4 flex flex-wrap items-center gap-2">''',
'''        {!contributors.length ? (\n          <section className="py-6">\n            <h5 className="font-display text-[18px] font-semibold leading-tight text-foreground">Set up song rights</h5>\n            <p className="mt-1.5 max-w-lg text-[12px] font-medium leading-5 text-muted-foreground/72">Add contributors and splits before release.</p>\n            <div className="mt-4 flex flex-wrap items-center gap-2">''',
'rights empty intro',
)
replace_once(
'''            </button>\n          </div>\n        ) : null}\n\n        {contributors.length > 0 && (totalPublishing !== 100 || totalMaster !== 100) ? (''',
'''            </button>\n            </div>\n          </section>\n        ) : null}\n\n        {contributors.length > 0 && (totalPublishing !== 100 || totalMaster !== 100) ? (''',
'rights empty close',
)
# Make the desktop ledger a single responsive DOM rather than a forced horizontal-scroll table on phones.
replace_once(
'''          <div className="mt-4 overflow-x-auto rounded-[16px] border border-foreground/8 bg-background/70">\n            <div className="min-w-[620px]">\n              <div className={cn("grid gap-2 border-b border-foreground/8 bg-foreground/[0.025] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/82", ledgerColumns)}>''',
'''          <div className="mt-5 overflow-hidden rounded-[16px] border border-foreground/8 bg-background">\n            <div>\n              <div className={cn("hidden gap-2 border-b border-foreground/8 bg-foreground/[0.025] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/72 sm:grid", ledgerColumns)}>''',
'rights ledger shell',
)
replace_once(
'''                  <div key={contributor.id ?? contributor.name} className={cn("grid items-center gap-2 border-b border-foreground/6 px-4 py-3.5 last:border-b-0", ledgerColumns)}>\n                    <span className="truncate text-[14px] font-bold text-foreground">{contributor.name}</span>\n                    <span className="truncate text-[12px] font-semibold text-muted-foreground/84">{contributor.role}</span>\n                    <span className="truncate text-[12px] font-semibold text-muted-foreground/84">{contributor.email ?? "Missing"}</span>\n                    <span className="text-[12px] font-bold text-foreground">{contributor.publishingShare}</span>\n                    <span className="text-[12px] font-bold text-foreground">{contributor.masterShare}</span>\n                    <span className="flex min-w-0 items-center gap-1.5">''',
'''                  <div key={contributor.id ?? contributor.name} className={cn("grid items-center gap-x-3 gap-y-2 border-b border-foreground/6 px-4 py-3.5 last:border-b-0", ledgerColumns)}>\n                    <span className="col-span-2 truncate text-[13px] font-semibold text-foreground sm:col-span-1 sm:text-[14px]">{contributor.name}</span>\n                    <span className="col-span-2 truncate text-[11px] font-medium text-muted-foreground/76 sm:col-span-1 sm:text-[12px]">{contributor.role}</span>\n                    <span className="col-span-2 truncate text-[11px] font-medium text-muted-foreground/76 sm:col-span-1 sm:text-[12px]">{contributor.email ?? "Missing"}</span>\n                    <span className="text-[12px] font-semibold text-foreground"><span className="mb-0.5 block text-[9px] font-medium uppercase tracking-[0.07em] text-muted-foreground/65 sm:hidden">Publishing</span>{contributor.publishingShare}</span>\n                    <span className="text-[12px] font-semibold text-foreground"><span className="mb-0.5 block text-[9px] font-medium uppercase tracking-[0.07em] text-muted-foreground/65 sm:hidden">Master</span>{contributor.masterShare}</span>\n                    <span className="col-span-2 flex min-w-0 items-center gap-1.5 sm:col-span-1">''',
'rights contributor row',
)
replace_once(
'''                      <span className="pr-2 text-right">''',
'''                      <span className="col-span-2 pr-0 text-right sm:col-span-1 sm:pr-2">''',
'rights remove cell',
)
replace_once(
'''          <form onSubmit={handleAddContributor} className="mt-4 rounded-[16px] border border-foreground/8 bg-foreground/[0.02] p-4">\n            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/86">Add collaborator</p>''',
'''          <form onSubmit={handleAddContributor} className="mt-5 border-t border-foreground/8 pt-5">\n            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/70">Add contributor</p>''',
'rights contributor form',
)
text = text.replace('text-[12px] font-bold uppercase tracking-[0.08em] text-background', 'text-[12px] font-semibold text-background')
replace_once(
'''        <details className="surface-elevated rounded-[18px] p-5 shadow-sm">''',
'''        <details className="mt-7 border-t border-foreground/8 pt-5">''',
'approval log shell',
)
replace_once(
'''              <div key={`${entry}-${index}`} className="flex items-start gap-2.5 rounded-[12px] border border-foreground/6 bg-background/68 px-3.5 py-2.5 text-[12.5px] font-bold leading-relaxed text-foreground/85">''',
'''              <div key={`${entry}-${index}`} className="flex items-start gap-2.5 border-t border-foreground/7 py-2.5 text-[12px] font-medium leading-5 text-foreground/82 first:border-t-0">''',
'approval log entries',
)

MUSIC.write_text(text)

# Add a design-contract test that protects hierarchy, responsive shells, and the shared type scale.
TEST = Path('src/song-room-tab-design.test.ts')
TEST.write_text('''import { describe, expect, it } from "vitest";\nimport { readFileSync } from "node:fs";\n\nconst music = readFileSync("src/features/music/MusicScreens.tsx", "utf8");\n\ndescribe("song room tab visual system", () => {\n  it("uses one bounded editorial shell for Files, Details, and Rights", () => {\n    expect(music).toContain('data-testid="song-room-files" className="mx-auto w-full max-w-4xl"');\n    expect(music).toContain('data-testid="song-room-details" className="mx-auto w-full max-w-4xl"');\n    expect(music).toContain('data-testid="song-room-rights" className="mx-auto w-full max-w-4xl"');\n  });\n\n  it("uses the same section-title and supporting-copy scale across the song room", () => {\n    expect(music.match(/text-\\[20px\\].*sm:text-\\[22px\\]/g)?.length ?? 0).toBeGreaterThanOrEqual(3);\n    expect(music).toContain('text-[12px] font-medium leading-5 text-muted-foreground/78');\n  });\n\n  it("keeps Details and Rights mobile-native instead of forcing desktop tables onto phones", () => {\n    expect(music).toContain('data-testid="song-room-mobile-details"');\n    expect(music).toContain('grid-cols-2 sm:grid-cols-[1.3fr_1fr_1.25fr_0.85fr_0.85fr_1.15fr]');\n    expect(music).not.toContain('min-w-[620px]');\n  });\n\n  it("keeps Rights empty-state copy short", () => {\n    expect(music).toContain('Add contributors and splits before release.');\n  });\n});\n''')
