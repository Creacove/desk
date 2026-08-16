from pathlib import Path

path = Path('src/features/music/MusicScreens.tsx')
text = path.read_text()

replacements = [
    (
        '<div className="mt-5 grid grid-cols-3 gap-0 border-y border-foreground/8 py-4">',
        '<div className={cn("mt-5 grid gap-0 border-y border-foreground/8 py-4", confirmationActive ? "grid-cols-3" : "grid-cols-2")}>',
        'adaptive rights metric columns',
    ),
    (
        '<strong className="mt-1 block text-[15px] font-semibold text-foreground">{rights.masterAllocated}%</strong>',
        '<strong className="mt-1 block text-[14px] font-semibold leading-none text-foreground sm:text-[15px]">{rights.masterAllocated}%</strong>',
        'master metric value scale',
    ),
    (
        '<strong className="mt-1 block text-[15px] font-semibold text-foreground">{rights.confirmedCount} of {rights.contributorCount}</strong>',
        '<strong className="mt-1 block text-[14px] font-semibold leading-none text-foreground sm:text-[15px]">{rights.confirmedCount} of {rights.contributorCount}</strong>',
        'confirmed metric value scale',
    ),
    (
        '<p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">{groupTitle}</p>\n            <h3 className="mt-1 font-display text-[24px] font-bold leading-tight text-foreground">Edit {field.label}</h3>',
        '<p className="sr-only">{groupTitle}</p>\n            <h3 className="font-display text-[24px] font-bold leading-tight text-foreground">Edit {field.label}</h3>',
        'detail modal redundant eyebrow',
    ),
    (
        '<label className="grid gap-2 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground/84">\n          Value',
        '<label className="grid">\n          <span className="sr-only">Value</span>',
        'detail modal visible value label',
    ),
]

for old, new, label in replacements:
    if old not in text:
        raise SystemExit(f'missing anchor: {label}')
    text = text.replace(old, new, 1)

path.write_text(text)
