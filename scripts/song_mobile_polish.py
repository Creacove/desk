from pathlib import Path

path = Path('src/features/music/MusicScreens.tsx')
text = path.read_text()

replacements = [
    (
        'whitespace-pre-line font-display text-[18px] font-medium leading-[1.55] tracking-[-0.01em] text-foreground sm:text-[21px] sm:leading-[1.5]',
        'whitespace-pre-line text-[14px] font-medium leading-6 text-foreground/90 sm:text-[15px] sm:leading-6',
        'manager read mobile type scale',
    ),
    (
        '<p className="mt-3 text-[12px] font-semibold leading-relaxed text-muted-foreground/80">Provider-confirmed metadata stays read-only. This saves a user-supplied draft for incomplete fields.</p>\n',
        '',
        'detail edit modal helper copy',
    ),
    (
        '{kind === "songs" ? <p className="mt-2 max-w-md text-[12px] font-medium leading-relaxed text-muted-foreground">Create the song first. You can add the audio, credits, rights, and details once you arrive.</p> : null}\n',
        '',
        'create modal helper copy',
    ),
    (
        '{kind === "songs" ? <p id="song-lifecycle-stage-help" className="-mt-1 normal-case text-[11px] font-medium tracking-normal text-muted-foreground">Choose the truest current stage. You can change it later.</p> : null}\n',
        '',
        'create modal lifecycle helper',
    ),
    (
        'aria-describedby={kind === "songs" ? "song-lifecycle-stage-help" : undefined} ',
        '',
        'remove obsolete lifecycle aria description',
    ),
    (
        'mt-5 grid gap-3 border-y border-foreground/8 py-4 sm:grid-cols-3 sm:gap-0',
        'mt-5 grid grid-cols-3 gap-0 border-y border-foreground/8 py-4',
        'rights metrics horizontal grid',
    ),
    (
        'text-[11px] font-medium text-muted-foreground sm:border-r sm:border-foreground/8 sm:px-4 sm:first:pl-0',
        'min-w-0 border-r border-foreground/8 px-3 text-[10px] font-medium leading-4 text-muted-foreground first:pl-0 sm:px-4',
        'rights publishing metric cell',
    ),
    (
        'text-[11px] font-medium text-muted-foreground sm:border-r sm:border-foreground/8 sm:px-4',
        'min-w-0 border-r border-foreground/8 px-3 text-[10px] font-medium leading-4 text-muted-foreground sm:px-4',
        'rights master metric cell',
    ),
    (
        'text-[11px] font-medium text-muted-foreground sm:px-4',
        'min-w-0 px-3 text-[10px] font-medium leading-4 text-muted-foreground last:pr-0 sm:px-4',
        'rights confirmed metric cell',
    ),
    (
        'mt-1 block text-[15px] font-semibold text-foreground',
        'mt-1 block text-[14px] font-semibold leading-none text-foreground sm:text-[15px]',
        'rights metric value scale',
    ),
]

for old, new, label in replacements:
    if old not in text:
        raise SystemExit(f'missing anchor: {label}')
    text = text.replace(old, new, 1)

path.write_text(text)
