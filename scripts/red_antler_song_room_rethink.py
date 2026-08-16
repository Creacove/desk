from pathlib import Path
import re

MUSIC = Path('src/features/music/MusicScreens.tsx')
text = MUSIC.read_text()

text = text.replace(
    'import { AlertCircle, ArrowLeft, ArrowRight, Check, ChevronRight, Copy, Disc3, Download, FileAudio, FileText, Image as ImageIcon, ListMusic, Loader2, Pencil, Play, Plus, RefreshCw, RotateCcw, Search, Share2, Sparkles, Trash2, Upload, UsersRound, X } from "lucide-react";',
    'import { AlertCircle, ArrowLeft, ArrowRight, Check, ChevronRight, Copy, Disc3, Download, FileAudio, FileText, Image as ImageIcon, ListMusic, Loader2, MessageCircle, Pencil, Play, Plus, RefreshCw, RotateCcw, Search, Share2, Sparkles, Trash2, Upload, UsersRound, X } from "lucide-react";',
)
text = text.replace('import { ReleaseWorkAttachment } from "./SongRoomAttachments";\n', '')
text = text.replace('import { SongCampaignWorkspace } from "./SongCampaignWorkspace";\n', '')
text = text.replace('import { deriveSongCampaignState } from "./songCampaign";\n', '')

# Campaign was a navigation destination without a unique job. Keep the internal campaign model elsewhere,
# but remove this redundant surface from the Song Room.
text = text.replace('          onStartCampaignWork={onOpenManager ? (starterPrompt) => onOpenManager(selected, starterPrompt) : undefined}\n', '')
text = text.replace('  onStartCampaignWork,\n', '')
text = text.replace('  onStartCampaignWork?: (starterPrompt: string) => void;\n', '')

pattern = re.compile(
    r'  const campaign = useMemo\(\(\) => deriveSongCampaignState\(song, linkedMissions\), \[song, linkedMissions\]\);\n'
    r'  const effectiveTab: SongRoomTab = activeTab === "campaign" && !campaign\.visible \? "overview" : activeTab;\n'
    r'  const songTabs: SongRoomTab\[\] = campaign\.visible\n'
    r'    \? \["overview", "campaign", "files", "details", "rights"\]\n'
    r'    : \["overview", "files", "details", "rights"\];\n'
    r'  const releaseKitPrompt = campaign\.phase === "post_release".*?;\n\n'
    r'  async function playAsset',
    re.S,
)
replacement = '''  const effectiveTab: SongRoomTab = activeTab === "campaign" ? "overview" : activeTab;
  const songTabs: SongRoomTab[] = ["overview", "files", "details", "rights"];

  async function playAsset'''
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit('campaign navigation block not found')

text = text.replace(
    '<MusicDetailTop object={song} label="Song room" onBack={onBack} onStageChange={onStageChange} />',
    '<MusicDetailTop object={song} label="Song room" onBack={onBack} onStageChange={onStageChange} onOpenManager={onContinueWithManager} />',
    1,
)

# Replace the old dashboard-like overview + campaign page with one editorial read and, only when present,
# one active mission row.
overview_pattern = re.compile(
    r'      \{effectiveTab === "overview" \? \(\n.*?\n      \{effectiveTab === "files" \? \(',
    re.S,
)
overview_replacement = '''      {effectiveTab === "overview" ? (
        <div data-testid="song-room-mobile-overview" className="mx-auto w-full max-w-4xl">
          <SongOverviewRead
            song={song}
            onGenerateBrief={onGenerateBrief}
            onContinueWithManager={onContinueWithManager}
            briefPending={briefPending}
            briefError={briefError}
          />
          {linkedMissions[0] ? (
            <section className="mt-7 border-t border-foreground/8 pt-5 sm:mt-8 sm:pt-6" aria-label="Active work">
              <p className="font-ui text-[9px] font-bold uppercase tracking-[0.11em] text-muted-foreground/65">Active mission</p>
              <button
                type="button"
                onClick={() => onOpenMission(linkedMissions[0].id)}
                className="mt-2 flex w-full items-center justify-between gap-5 rounded-[12px] py-2 text-left focus:outline-none focus:ring-2 focus:ring-brand-accent/25"
              >
                <span className="min-w-0 truncate text-[14px] font-semibold text-foreground sm:text-[15px]">{linkedMissions[0].title}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            </section>
          ) : null}
        </div>
      ) : null}

      {effectiveTab === "files" ? ('''
text, count = overview_pattern.subn(overview_replacement, text, count=1)
if count != 1:
    raise SystemExit('overview/campaign render block not found')

# Put the Manager action in the song identity header instead of adding another overview card.
text = text.replace(
    'function MusicDetailTop({ object, label, onBack, onStageChange }: { object: MusicObjectViewModel; label: string; onBack: () => void; onStageChange?: (stage: string) => void }) {',
    'function MusicDetailTop({ object, label, onBack, onStageChange, onOpenManager }: { object: MusicObjectViewModel; label: string; onBack: () => void; onStageChange?: (stage: string) => void; onOpenManager?: () => void }) {',
    1,
)
mobile_title = '''          <div className="min-w-0 flex-1">
            <p data-testid="music-detail-mobile-title" className="min-w-0 break-words [overflow-wrap:anywhere] font-display text-[20px] font-semibold leading-tight text-foreground">{object.title}</p>
          </div>'''
mobile_title_new = '''          <div className="min-w-0 flex-1">
            <p data-testid="music-detail-mobile-title" className="min-w-0 break-words [overflow-wrap:anywhere] font-display text-[20px] font-semibold leading-tight text-foreground">{object.title}</p>
            {onOpenManager ? (
              <button type="button" onClick={onOpenManager} className="mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background transition-opacity hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-brand-accent/30">
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> Chat with Manager
              </button>
            ) : null}
          </div>'''
if mobile_title not in text:
    raise SystemExit('mobile song title anchor missing')
text = text.replace(mobile_title, mobile_title_new, 1)

desktop_title = '''          <div className="min-w-0">
            <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/82">{label}</p>
            <h2 className="mt-2 min-w-0 break-words [overflow-wrap:anywhere] font-display text-[26px] font-semibold leading-tight text-foreground lg:text-[32px]">{object.title}</h2>
          </div>'''
desktop_title_new = '''          <div className="min-w-0">
            <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/82">{label}</p>
            <h2 className="mt-2 min-w-0 break-words [overflow-wrap:anywhere] font-display text-[26px] font-semibold leading-tight text-foreground lg:text-[32px]">{object.title}</h2>
            {onOpenManager ? (
              <button type="button" onClick={onOpenManager} className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-[10px] bg-foreground px-3.5 py-2 text-[11px] font-semibold text-background transition-opacity hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-brand-accent/30">
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> Chat with Manager
              </button>
            ) : null}
          </div>'''
if desktop_title not in text:
    raise SystemExit('desktop song title anchor missing')
text = text.replace(desktop_title, desktop_title_new, 1)

# Song Overview gets a restrained Manager Read presentation. The richer generic renderer remains available
# for projects, but the song room should expose only the highest-value intelligence.
anchor = 'function MusicManagerReadContent({\n'
if anchor not in text:
    raise SystemExit('manager read component anchor missing')
song_read = r'''function SongOverviewRead({
  song,
  onGenerateBrief,
  onContinueWithManager,
  briefPending,
  briefError,
}: {
  song: MusicObjectViewModel;
  onGenerateBrief: () => void;
  onContinueWithManager?: () => void;
  briefPending: boolean;
  briefError: string | null;
}) {
  const read = song.managerRead;
  const readBusy = briefPending || isActiveManagerRead(song.managerReadStatus);
  const failed = song.managerReadStatus === "failed" || song.managerReadStatus === "refresh_failed" || Boolean(briefError);
  const actionLabel = managerReadButtonLabel("song", song.managerReadStatus);

  return (
    <section data-testid="song-room-overview-read" className="pt-1 sm:pt-2">
      <div className="flex items-center justify-between gap-4">
        <p className="font-ui text-[10px] font-bold uppercase tracking-[0.11em] text-muted-foreground/65">Manager&apos;s read</p>
        {read ? (
          <button
            type="button"
            aria-label={briefPending ? "Manager is reading" : actionLabel}
            title={briefPending ? "Manager is reading" : actionLabel}
            onClick={onGenerateBrief}
            disabled={readBusy}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/10 text-muted-foreground transition-colors hover:bg-foreground/[0.035] hover:text-foreground focus:outline-none focus:ring-2 focus:ring-brand-accent/25 disabled:opacity-40"
          >
            {readBusy ? <AppThinkingOrb surface="normal" state="composing" size={18} /> : managerReadButtonIcon(song.managerReadStatus)}
          </button>
        ) : null}
      </div>

      {read ? (
        <div className="mt-4 max-w-3xl">
          {failed ? <p className="mb-3 text-[11px] font-medium text-muted-foreground">Couldn&apos;t refresh just now. Showing the last read.</p> : null}
          <p className="whitespace-pre-line font-display text-[18px] font-medium leading-[1.55] tracking-[-0.01em] text-foreground sm:text-[21px] sm:leading-[1.5]">{read.body}</p>
        </div>
      ) : (
        <div className="mt-4 max-w-xl">
          <h3 className="font-display text-[20px] font-semibold leading-tight tracking-[-0.01em] text-foreground sm:text-[22px]">
            {failed ? "Manager couldn’t complete the read." : "Get Manager’s take on this record."}
          </h3>
          <p className="mt-2 text-[12px] font-medium leading-5 text-muted-foreground">
            {failed ? "Try again when you’re ready." : "A concise read of what matters now, grounded in the song and its current workspace."}
          </p>
          <button
            type="button"
            onClick={onGenerateBrief}
            disabled={readBusy}
            className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-[10px] bg-foreground px-3.5 py-2 text-[11px] font-semibold text-background transition-opacity hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 disabled:opacity-40"
          >
            {readBusy ? <AppThinkingOrb surface="inverse" state="composing" size={18} /> : failed ? <RotateCcw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
            {briefPending ? "Manager is reading" : failed ? "Try again" : "Get Manager’s read"}
          </button>
        </div>
      )}

      {read && onContinueWithManager ? (
        <button type="button" onClick={onContinueWithManager} className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-brand-accent/25">
          Discuss this with Manager <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </section>
  );
}

'''
text = text.replace(anchor, song_read + anchor, 1)
MUSIC.write_text(text)

APP = Path('src/app/ProductionApp.tsx')
app = APP.read_text()
old = '  const showMobileTabbar = view !== "conversationWorkspace" && view !== "investigation" && view !== "decisionPackage";'
new = '  const showMobileTabbar = view !== "conversationWorkspace" && view !== "investigation" && view !== "decisionPackage" && !(view === "musicWorkspace" && musicDetailOpen);'
if old not in app:
    raise SystemExit('mobile tabbar visibility anchor missing')
APP.write_text(app.replace(old, new, 1))

TEST = Path('src/song-room-red-antler-overview.test.ts')
TEST.write_text(r'''import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const music = readFileSync("src/features/music/MusicScreens.tsx", "utf8");
const app = readFileSync("src/app/ProductionApp.tsx", "utf8");

describe("song room minimal hierarchy", () => {
  it("keeps only four job-based tabs and removes the campaign surface", () => {
    expect(music).toContain('const songTabs: SongRoomTab[] = ["overview", "files", "details", "rights"]');
    expect(music).not.toContain('<SongCampaignWorkspace');
    expect(music).not.toContain('ReleaseWorkAttachment');
  });

  it("makes Manager the primary song action and Manager Read the overview", () => {
    expect(music).toContain('Chat with Manager');
    expect(music).toContain('data-testid="song-room-overview-read"');
    expect(music).toContain('Manager&apos;s read');
    expect(music).not.toContain('data-testid="manager-read-metrics" className="grid grid-cols-2 xl:grid-cols-3"');
  });

  it("hides the global mobile tab bar while a music room is open", () => {
    expect(app).toContain('!(view === "musicWorkspace" && musicDetailOpen)');
  });
});
''')
