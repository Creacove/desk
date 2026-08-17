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
test_path.write_text(test)
