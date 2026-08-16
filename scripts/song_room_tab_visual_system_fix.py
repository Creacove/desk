from pathlib import Path

path = Path('src/features/music/MusicScreens.tsx')
text = path.read_text()

old = '<span className="block">Publishing</span><strong className="mt-1 block text-[15px] font-semibold text-foreground">{rights.publishingAllocated}%</strong>'
new = '<span className="block">Publishing allocated</span><strong className="mt-1 block text-[15px] font-semibold text-foreground">{rights.publishingAllocated}%</strong>'
if old not in text:
    raise SystemExit('publishing stat anchor missing')
text = text.replace(old, new, 1)

old = '<span className="block">Master</span><strong className="mt-1 block text-[15px] font-semibold text-foreground">{rights.masterAllocated}%</strong>'
new = '<span className="block">Master allocated</span><strong className="mt-1 block text-[15px] font-semibold text-foreground">{rights.masterAllocated}%</strong>'
if old not in text:
    raise SystemExit('master stat anchor missing')
text = text.replace(old, new, 1)

anchor = '''            {confirmationActive ? <p className="text-[11px] font-medium text-muted-foreground sm:px-4"><span className="block">Confirmed</span><strong className="mt-1 block text-[15px] font-semibold text-foreground">{rights.confirmedCount} of {rights.contributorCount}</strong></p> : null}\n          </div>\n        ) : null}\n\n        {!contributors.length ? ('''
replacement = '''            {confirmationActive ? <p className="text-[11px] font-medium text-muted-foreground sm:px-4"><span className="block">Confirmed</span><strong className="mt-1 block text-[15px] font-semibold text-foreground">{rights.confirmedCount} of {rights.contributorCount}</strong></p> : null}\n          </div>\n        ) : null}\n\n        {contributors.length && confirmationActive ? (\n          <p className="mt-3 text-[11px] font-medium leading-5 text-muted-foreground/72">{rights.description}</p>\n        ) : null}\n\n        {!contributors.length ? ('''
if anchor not in text:
    raise SystemExit('confirmation status anchor missing')
text = text.replace(anchor, replacement, 1)

path.write_text(text)
