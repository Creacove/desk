from pathlib import Path

music_path = Path("src/features/music/MusicScreens.tsx")
source = music_path.read_text()
source = source.replace(
    '<p className="font-ui text-[9px] font-bold uppercase tracking-[0.11em] text-muted-foreground/58">{label}</p>',
    '<p className="font-ui text-[9px] font-bold uppercase tracking-[0.11em] text-muted-foreground/58">{object.kind === "song" ? "Song" : label}</p>',
)
source = source.replace(
    '<p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/58">{label}</p>',
    '<p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/58">{object.kind === "song" ? "Song" : label}</p>',
)
music_path.write_text(source)

test_path = Path("src/production-app-shell.test.tsx")
tests = test_path.read_text().replace(
    'expect(within(readSurface).getByRole("button", { name: "Try again" })).toBeEnabled();',
    'expect(within(readSurface).getByRole("button", { name: "Retry record review" })).toBeEnabled();',
)
test_path.write_text(tests)
