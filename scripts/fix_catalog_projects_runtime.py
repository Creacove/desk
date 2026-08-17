from pathlib import Path

path = Path("src/features/music/MusicScreens.tsx")
text = path.read_text()

# thinking-orbs only supports the tuned 20 and 64 presets. Keep call sites honest
# in addition to the runtime guard in AppThinkingOrb.
if 'size={18}' not in text:
    raise SystemExit("expected unsupported 18px orb call sites")
text = text.replace('size={18}', 'size={20}')

# Persisted Manager Reads predate the current structured render shape. Never trust
# a historical JSON payload to satisfy the current TypeScript interface at runtime.
old = '''  const read = project.managerRead;
  const readBusy = briefPending || isActiveManagerRead(project.managerReadStatus);
  const failed = project.managerReadStatus === "failed" || project.managerReadStatus === "refresh_failed" || Boolean(briefError);
  const actionLabel = failed ? "Retry project review" : read ? "Refresh project review" : "Review this project";
'''
new = '''  const read = project.managerRead;
  const metrics = Array.isArray(read?.metrics) ? read.metrics : [];
  const readBody = typeof read?.body === "string" ? read.body : project.managerReadSummary ?? "";
  const readBusy = briefPending || isActiveManagerRead(project.managerReadStatus);
  const failed = project.managerReadStatus === "failed" || project.managerReadStatus === "refresh_failed" || Boolean(briefError);
  const actionLabel = failed ? "Retry project review" : read ? "Refresh project review" : "Review this project";
'''
if old not in text:
    raise SystemExit("missing MusicProjectBrief state anchor")
text = text.replace(old, new, 1)

text = text.replace(
    '''          {read.metrics.length ? (
            <div data-testid="manager-read-metrics" className="mb-5 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-foreground/8 py-4 sm:grid-cols-3">
              {read.metrics.slice(0, 3).map((metric) => (''',
    '''          {metrics.length ? (
            <div data-testid="manager-read-metrics" className="mb-5 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-foreground/8 py-4 sm:grid-cols-3">
              {metrics.slice(0, 3).map((metric) => (''',
    1,
)
text = text.replace(
    '''          <p className="whitespace-pre-line text-[14px] font-medium leading-6 text-foreground/90 sm:text-[15px]">{read.body}</p>''',
    '''          {readBody ? <p className="whitespace-pre-line text-[14px] font-medium leading-6 text-foreground/90 sm:text-[15px]">{readBody}</p> : null}''',
    1,
)

path.write_text(text)
