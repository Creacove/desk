from pathlib import Path

orb_path = Path("src/design-system/AppThinkingOrb.tsx")
orb = orb_path.read_text()
old_orb = '''export function AppThinkingOrb({ surface = "normal", ...props }: AppThinkingOrbProps) {
  const { resolvedMode } = useTheme();
  const theme = surface === "inverse"
    ? resolvedMode === "dark" ? "light" : "dark"
    : resolvedMode;

  return <ThinkingOrb {...props} theme={theme} />;
}
'''
new_orb = '''export function AppThinkingOrb({ surface = "normal", size = 20, ...props }: AppThinkingOrbProps) {
  const { resolvedMode } = useTheme();
  const theme = surface === "inverse"
    ? resolvedMode === "dark" ? "light" : "dark"
    : resolvedMode;

  // thinking-orbs currently ships rendering presets only for 20px and 64px.
  // Passing any other numeric size makes the package dereference an undefined
  // preset at runtime (for example `preset.count`) and crashes the React tree.
  // Keep this boundary defensive even when a caller requests a custom size.
  const safeSize = size === 64 ? 64 : 20;

  return <ThinkingOrb {...props} size={safeSize} theme={theme} />;
}
'''
if old_orb not in orb:
    raise SystemExit("AppThinkingOrb target block not found")
orb_path.write_text(orb.replace(old_orb, new_orb))

music_path = Path("src/features/music/MusicScreens.tsx")
music = music_path.read_text()
occurrences = music.count('size={18}')
if occurrences < 1:
    raise SystemExit("Expected at least one unsupported 18px ThinkingOrb callsite")
music = music.replace('size={18}', 'size={20}')
music_path.write_text(music)
print(f"Normalized {occurrences} catalog ThinkingOrb callsites from 18px to 20px")
