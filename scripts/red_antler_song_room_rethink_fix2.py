from pathlib import Path

path = Path('src/features/music/MusicScreens.tsx')
text = path.read_text()
# The reducer pass intentionally removed the lower Overview CTA but must preserve the Song Room's header Manager action.
text = text.replace('  onGenerateBrief,\n  briefPending,', '  onGenerateBrief,\n  onContinueWithManager,\n  briefPending,', 1)
text = text.replace('  onGenerateBrief: () => void;\n  briefPending: boolean;', '  onGenerateBrief: () => void;\n  onContinueWithManager?: () => void;\n  briefPending: boolean;', 1)
path.write_text(text)
