from pathlib import Path


# This runs after catalog_manager_beauty_pass.py. Keep accessibility and stable
# behavioral hooks without restoring the visible labels the redesign removed.
music_path = Path("src/features/music/MusicScreens.tsx")
music = music_path.read_text()

# Compact rows remain explicitly min-height-free for the mobile contract.
music = music.replace(
    'className="group grid w-full grid-cols-[24px_48px_minmax(0,1fr)_auto] items-center',
    'className="group grid min-h-0 min-w-0 w-full grid-cols-[24px_48px_minmax(0,1fr)_auto] items-center',
)

# Visible copy stays simply “Catalog”; the fuller navigation intent is retained
# for accessibility and automation.
desktop_back = '<button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground">'
if desktop_back not in music:
    raise SystemExit("missing desktop Catalog back action")
music = music.replace(
    desktop_back,
    '<button type="button" aria-label="Back to Catalog" onClick={onBack} className="inline-flex items-center gap-2 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground">',
    1,
)

# Keep the released-stage hook on the compact stage text; no extra visible pill.
locked_stage = '<span className="text-[10px] font-semibold text-muted-foreground/58">{stageValue}</span>'
if locked_stage not in music:
    raise SystemExit("missing compact mobile stage")
music = music.replace(
    locked_stage,
    '<span data-testid={lockedReleasedStage ? "mobile-locked-song-stage" : undefined} className="text-[10px] font-semibold text-muted-foreground/58">{stageValue}</span>',
    1,
)

# Project review remains visually minimal, but status is still exposed to assistive
# tech and the refresh action keeps its established accessible name. Do not show a
# second icon action when the primary empty/error CTA is already present.
project_section = '''  return (
    <section className="border-t border-foreground/8 pt-6">
      <div className="flex items-center justify-between gap-4">'''
if project_section not in music:
    raise SystemExit("missing project review section")
music = music.replace(
    project_section,
    '''  return (
    <section data-testid="project-manager-read-copy" className="border-t border-foreground/8 pt-6">
      <span className="sr-only">{managerReadStatusLabel(project.managerReadStatus)}</span>
      {project.managerReadStatus === "refreshing" ? <span className="sr-only">Updating from latest song changes. The current read remains available.</span> : null}
      {project.managerReadStatus === "refresh_failed" ? <span className="sr-only">Manager Read could not be refreshed. Your previous read is still available.</span> : null}
      <div className="flex items-center justify-between gap-4">''',
    1,
)

project_header_action = '''        <button
          type="button"
          onClick={onGenerateBrief}
          disabled={readBusy}
          aria-label={briefPending ? "Reviewing this project" : actionLabel}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/10 text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground focus:outline-none focus:ring-2 focus:ring-brand-accent/30 disabled:opacity-40"
        >
          {readBusy ? <AppThinkingOrb surface="normal" state="composing" size={18} /> : managerReadButtonIcon(project.managerReadStatus)}
        </button>'''
if project_header_action not in music:
    raise SystemExit("missing project review header action")
music = music.replace(
    project_header_action,
    '''        {read || readBusy ? (
          <button
            type="button"
            onClick={onGenerateBrief}
            disabled={readBusy}
            aria-label={managerReadButtonLabel("project", project.managerReadStatus)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/10 text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground focus:outline-none focus:ring-2 focus:ring-brand-accent/30 disabled:opacity-40"
          >
            {readBusy ? <AppThinkingOrb surface="normal" state="composing" size={18} /> : managerReadButtonIcon(project.managerReadStatus)}
          </button>
        ) : null}''',
    1,
)

metrics = '<div className="mb-5 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-foreground/8 py-4 sm:grid-cols-3">'
if metrics not in music:
    raise SystemExit("missing project metric strip")
music = music.replace(
    metrics,
    '<div data-testid="manager-read-metrics" className="mb-5 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-foreground/8 py-4 sm:grid-cols-3">',
    1,
)

empty_action = '<button type="button" onClick={onGenerateBrief} className="mt-4 inline-flex h-9 items-center gap-2 rounded-[10px] bg-foreground px-3.5 text-[11px] font-semibold text-background">'
if empty_action not in music:
    raise SystemExit("missing project empty review action")
music = music.replace(
    empty_action,
    '<button type="button" aria-label={managerReadButtonLabel("project", project.managerReadStatus)} onClick={onGenerateBrief} className="mt-4 inline-flex h-9 items-center gap-2 rounded-[10px] bg-foreground px-3.5 text-[11px] font-semibold text-background">',
    1,
)

music_path.write_text(music)


test_path = Path("src/production-app-shell.test.tsx")
test = test_path.read_text()
# New copy is intentionally shorter. Tests should follow the product contract,
# not force old visible explanatory text back into the UI.
test = test.replace(
    'Ask the Manager for a directive or review...',
    'Ask Manager anything about this artist...',
)
test = test.replace(
    'expect(songRoom).toHaveTextContent("Song room");',
    'expect(songRoom).not.toHaveTextContent("Song room");',
)
test = test.replace(
    'expect(projectRoom).toHaveTextContent("No mission linked");',
    'expect(projectRoom).not.toHaveTextContent("No mission linked");',
)
test = test.replace(
    'expect(projectLinkedWork).toHaveTextContent("1 task attached");',
    'expect(projectLinkedWork).toHaveTextContent("1 task");',
)
test = test.replace(
    'expect(projectLinkedWork).toHaveTextContent("2 tasks attached");',
    'expect(projectLinkedWork).toHaveTextContent("2 tasks");',
)
test_path.write_text(test)
