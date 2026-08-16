from pathlib import Path

# Keep the focused contract scoped to the song overview. Project-level Manager Read keeps its richer metrics view.
path = Path('src/song-room-red-antler-overview.test.ts')
text = path.read_text()
text = text.replace('    expect(music).not.toContain(\'data-testid="manager-read-metrics" className="grid grid-cols-2 xl:grid-cols-3"\');\n', '    const songOverview = music.slice(music.indexOf(\'data-testid="song-room-overview-read"\'), music.indexOf(\'function MusicManagerReadContent\'));\n    expect(songOverview).not.toContain(\'manager-read-metrics\');\n')
path.write_text(text)

# Campaign no longer controls the Song Room tab count.
music_path = Path('src/features/music/MusicScreens.tsx')
music = music_path.read_text()
music = music.replace('        className={campaign.visible ? "grid-cols-5" : "grid-cols-4"}', '        className="grid-cols-4"')
# Chat belongs in the title hierarchy. Do not duplicate a second Manager CTA below the read.
music = music.replace('            onContinueWithManager={onContinueWithManager}\n', '')
music = music.replace('  onContinueWithManager,\n', '', 1)
music = music.replace('  onContinueWithManager?: () => void;\n', '', 1)
music = music.replace('''      {read && onContinueWithManager ? (\n        <button type="button" onClick={onContinueWithManager} className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-brand-accent/25">\n          Discuss this with Manager <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />\n        </button>\n      ) : null}\n''', '')
# A running first read should communicate one thing, not show a disabled invitation to start another read.
music = music.replace('''      ) : (\n        <div className="mt-4 max-w-xl">\n          <h3 className="font-display text-[20px] font-semibold leading-tight tracking-[-0.01em] text-foreground sm:text-[22px]">\n            {failed ? "Manager couldn’t complete the read." : "Get Manager’s take on this record."}\n          </h3>\n          <p className="mt-2 text-[12px] font-medium leading-5 text-muted-foreground">\n            {failed ? "Try again when you’re ready." : "A concise read of what matters now, grounded in the song and its current workspace."}\n          </p>\n          <button\n            type="button"\n            onClick={onGenerateBrief}\n            disabled={readBusy}\n            className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-[10px] bg-foreground px-3.5 py-2 text-[11px] font-semibold text-background transition-opacity hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 disabled:opacity-40"\n          >\n            {readBusy ? <AppThinkingOrb surface="inverse" state="composing" size={18} /> : failed ? <RotateCcw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}\n            {briefPending ? "Manager is reading" : failed ? "Try again" : "Get Manager’s read"}\n          </button>\n        </div>\n      )}\n''', '''      ) : readBusy ? (\n        <div className="mt-4 flex max-w-xl items-center gap-3 py-2">\n          <AppThinkingOrb surface="normal" state="composing" size={20} />\n          <p className="text-[13px] font-semibold text-muted-foreground">Manager is reading this record…</p>\n        </div>\n      ) : (\n        <div className="mt-4 max-w-xl">\n          <h3 className="font-display text-[20px] font-semibold leading-tight tracking-[-0.01em] text-foreground sm:text-[22px]">\n            {failed ? "Manager couldn’t complete the read." : "Get Manager’s take on this record."}\n          </h3>\n          <p className="mt-2 text-[12px] font-medium leading-5 text-muted-foreground">\n            {failed ? "Try again when you’re ready." : "A concise read of what matters now, grounded in the song and its current workspace."}\n          </p>\n          <button\n            type="button"\n            onClick={onGenerateBrief}\n            className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-[10px] bg-foreground px-3.5 py-2 text-[11px] font-semibold text-background transition-opacity hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-brand-accent/30"\n          >\n            {failed ? <RotateCcw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}\n            {failed ? "Try again" : "Get Manager’s read"}\n          </button>\n        </div>\n      )}\n''')
music_path.write_text(music)

# Align stale interaction expectations with already-shipped navigation, Share, and Manager labels.
shell_path = Path('src/production-app-shell.test.tsx')
shell = shell_path.read_text()
shell = shell.replace('expect(onOpenCreatedWork).toHaveBeenCalledWith("music_item", "song-attach", "files");', 'expect(onOpenCreatedWork).toHaveBeenCalledWith("music_item", "song-attach", "files", undefined);')
shell = shell.replace('expect(onOpenCreatedWork).toHaveBeenCalledWith("music_item", "song-after-hours");', 'expect(onOpenCreatedWork).toHaveBeenCalledWith("music_item", "song-after-hours", undefined, undefined);')
shell = shell.replace('expect(screen.getByRole("dialog", { name: "Share Jam files" })).toBeInTheDocument();\n    expect(screen.getByLabelText("Final master")).toBeChecked();\n    fireEvent.click(await screen.findByRole("button", { name: "Manage links" }));', 'expect(screen.getByRole("dialog", { name: "Share Jam" })).toBeInTheDocument();\n    fireEvent.click(await screen.findByRole("button", { name: "Links" }));')
shell = shell.replace('fireEvent.click(screen.getByRole("button", { name: "Create link" }));\n    expect(await screen.findByRole("heading", { name: "Link ready" })).toBeInTheDocument();', 'fireEvent.click(await screen.findByRole("button", { name: /A&R \/ private listen/i }));\n    fireEvent.click(screen.getByRole("button", { name: "Preview private listen" }));\n    fireEvent.click(await screen.findByRole("button", { name: "Create private link" }));\n    expect(await screen.findByRole("heading", { name: "Share link ready" })).toBeInTheDocument();')
shell = shell.replace('fireEvent.click(screen.getByRole("button", { name: "Revoke link" }));', 'fireEvent.click(screen.getByRole("button", { name: "Revoke" }));')
shell = shell.replace('expect(screen.getByText("This package is no longer accessible.")).toBeInTheDocument();', 'expect(screen.getByText("This package can no longer be opened.")).toBeInTheDocument();')
# In jsdom both responsive header variants are present; scope the Manager action to the mobile header.
shell = shell.replace('fireEvent.click(within(screen.getByTestId("music-song-detail")).getByRole("button", { name: "Talk to Manager" }));', 'fireEvent.click(within(screen.getByTestId("music-detail-mobile-top")).getByRole("button", { name: "Chat with Manager" }));')
shell = shell.replace('fireEvent.click(within(screen.getByTestId("music-song-detail")).getByRole("button", { name: "Chat with Manager" }));', 'fireEvent.click(within(screen.getByTestId("music-detail-mobile-top")).getByRole("button", { name: "Chat with Manager" }));')

# The old ReleaseWorkAttachment was intentionally removed. Active work is now one quiet mission row.
shell = shell.replace('const songLinkedWork = within(screen.getByTestId("music-song-detail")).getByRole("region", { name: "Work on this song" });\n    expect(songLinkedWork).toHaveTextContent("Push Signal Song");\n    expect(songLinkedWork).not.toHaveTextContent("Confirm launch lane.");\n\n    fireEvent.click(within(songLinkedWork).getByRole("button", { name: "Open mission Push Signal Song" }));', 'const songLinkedWork = within(screen.getByTestId("music-song-detail")).getByRole("region", { name: "Active work" });\n    expect(songLinkedWork).toHaveTextContent("Push Signal Song");\n    expect(songLinkedWork).not.toHaveTextContent("Confirm launch lane.");\n\n    fireEvent.click(within(songLinkedWork).getByRole("button", { name: "Push Signal Song" }));')
shell = shell.replace('const releaseWork = within(room).getByRole("region", { name: "Work on this song" });\n    expect(releaseWork).toHaveTextContent("Prepare Jam for release");\n    expect(releaseWork).not.toHaveTextContent("Add the current working audio");\n    expect(within(room).queryByText("Linked work")).not.toBeInTheDocument();\n    expect(within(room).queryByTestId("music-linked-conversation")).not.toBeInTheDocument();\n    fireEvent.click(within(releaseWork).getByRole("button", { name: "Talk to Manager" }));\n    expect(onOpenManager).toHaveBeenCalledWith(subject);\n    fireEvent.click(within(releaseWork).getByRole("button", { name: "Open mission Prepare Jam for release" }));\n    expect(onOpenMission).toHaveBeenCalledWith("mission-jam-release");\n\n    expect(onOpenManager).toHaveBeenCalledTimes(1);\n    expect(within(room).getByTestId("manager-read-copy")).toHaveTextContent(completeSongManagerRead.body.split("\\n")[0]);', 'const activeWork = within(room).getByRole("region", { name: "Active work" });\n    expect(activeWork).toHaveTextContent("Prepare Jam for release");\n    expect(activeWork).not.toHaveTextContent("Add the current working audio");\n    expect(within(room).queryByText("Linked work")).not.toBeInTheDocument();\n    expect(within(room).queryByTestId("music-linked-conversation")).not.toBeInTheDocument();\n    fireEvent.click(within(screen.getByTestId("music-detail-mobile-top")).getByRole("button", { name: "Chat with Manager" }));\n    expect(onOpenManager).toHaveBeenCalledWith(subject);\n    fireEvent.click(within(activeWork).getByRole("button", { name: "Prepare Jam for release" }));\n    expect(onOpenMission).toHaveBeenCalledWith("mission-jam-release");\n\n    expect(onOpenManager).toHaveBeenCalledTimes(1);\n    expect(within(room).getByTestId("song-room-overview-read")).toHaveTextContent(completeSongManagerRead.body.split("\\n")[0]);')

# Song Overview is intentionally concise: read body only. Project Read retains metrics.
shell = shell.replace('it("renders the Manager Read body and metrics without repeating the song or project framing", async () => {', 'it("keeps the song read concise while preserving project-level metrics", async () => {')
shell = shell.replace('const songRead = within(songRoom).getByTestId("manager-read-copy");\n    expect(songRead).not.toHaveTextContent(completeSongManagerRead.position);\n    expect(songRead).not.toHaveTextContent("Lead attention asset — phase A.");\n    expect(songRoom).toHaveTextContent("Spotify streams (7d)");\n    expect(songRoom).toHaveTextContent("5.2M");\n    expect(songRoom).toHaveTextContent("Jam is carrying the strongest aligned public response");', 'const songRead = within(songRoom).getByTestId("song-room-overview-read");\n    expect(songRead).not.toHaveTextContent(completeSongManagerRead.position);\n    expect(songRead).not.toHaveTextContent("Lead attention asset — phase A.");\n    expect(songRead).not.toHaveTextContent("Spotify streams (7d)");\n    expect(songRead).not.toHaveTextContent("5.2M");\n    expect(songRead).toHaveTextContent("Jam is carrying the strongest aligned public response");')
old_metric_test = '''  it.each(["song", "project"] as const)("keeps %s Manager Read metrics in a two-column mobile grid", async (kind) => {
    const subject = musicReadSubject(kind, "fresh");
    const repositories = repositoriesFor("Nova Vale");

    render(
      <MusicWorkspace
        music={[subject]}
        missions={[]}
        musicRepository={repositories.music}
        onRefreshObject={repositories.music.loadMusicObject}
        onMusicChanged={async () => undefined}
        onOpenMission={() => undefined}
        onBack={() => undefined}
      />,
    );

    if (kind === "project") fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    fireEvent.click(screen.getByRole("button", { name: `Open ${kind} ${subject.title}` }));
    const read = screen.getByTestId(kind === "song" ? "manager-read-copy" : "project-manager-read-copy");
    expect(within(read).getByTestId("manager-read-metrics")).toHaveClass("grid-cols-2");
  });'''
new_metric_test = '''  it("keeps project Manager Read metrics in a two-column mobile grid", async () => {
    const subject = musicReadSubject("project", "fresh");
    const repositories = repositoriesFor("Nova Vale");

    render(
      <MusicWorkspace
        music={[subject]}
        missions={[]}
        musicRepository={repositories.music}
        onRefreshObject={repositories.music.loadMusicObject}
        onMusicChanged={async () => undefined}
        onOpenMission={() => undefined}
        onBack={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    fireEvent.click(screen.getByRole("button", { name: `Open project ${subject.title}` }));
    const read = screen.getByTestId("project-manager-read-copy");
    expect(within(read).getByTestId("manager-read-metrics")).toHaveClass("grid-cols-2");
  });'''
shell = shell.replace(old_metric_test, new_metric_test)

# State tests: song Overview no longer exposes system-state labels; it exposes only useful state/action.
old_state_assert = '''    const room = screen.getByTestId(kind === "song" ? "music-song-detail" : "music-project-detail");
    expect(room).toHaveTextContent(statusLabel);
    const button = within(room).getByRole("button", { name: buttonLabel });
    expect(button).toHaveProperty("disabled", disabled);
    if (disabled) {
      fireEvent.click(button);
      expect(startManagerRead).not.toHaveBeenCalled();
    }'''
new_state_assert = '''    const room = screen.getByTestId(kind === "song" ? "music-song-detail" : "music-project-detail");
    if (kind === "song") {
      const readSurface = within(room).getByTestId("song-room-overview-read");
      if (status === "running") {
        expect(readSurface).toHaveTextContent("Manager is reading this record");
        expect(within(readSurface).queryByRole("button", { name: /Manager Read/i })).not.toBeInTheDocument();
      } else if (status === "not_generated") {
        expect(readSurface).toHaveTextContent("Get Manager’s take on this record");
        expect(within(readSurface).getByRole("button", { name: "Get Manager’s read" })).toBeEnabled();
      } else if (status === "failed") {
        expect(readSurface).toHaveTextContent("Manager couldn’t complete the read");
        expect(within(readSurface).getByRole("button", { name: "Try again" })).toBeEnabled();
      } else {
        expect(readSurface).toHaveTextContent(subject.managerRead!.body.split("\\n")[0]);
        const button = within(readSurface).getByRole("button", { name: buttonLabel });
        expect(button).toHaveProperty("disabled", disabled);
      }
    } else {
      expect(room).toHaveTextContent(statusLabel);
      const button = within(room).getByRole("button", { name: buttonLabel });
      expect(button).toHaveProperty("disabled", disabled);
      if (disabled) {
        fireEvent.click(button);
        expect(startManagerRead).not.toHaveBeenCalled();
      }
    }'''
shell = shell.replace(old_state_assert, new_state_assert)

old_prior_assert = '''    const room = screen.getByTestId(kind === "song" ? "music-song-detail" : "music-project-detail");
    expect(room).toHaveTextContent(statusLabel);
    expect(room).toHaveTextContent(subject.managerRead!.body.split("\\n")[0]);
    expect(room).toHaveTextContent(safeMessage);
    expect(room).not.toHaveTextContent("OpenAI");'''
new_prior_assert = '''    const room = screen.getByTestId(kind === "song" ? "music-song-detail" : "music-project-detail");
    expect(room).toHaveTextContent(subject.managerRead!.body.split("\\n")[0]);
    if (kind === "song") {
      if (status === "refresh_failed") expect(room).toHaveTextContent("Couldn’t refresh just now. Showing the last read.");
      else expect(within(room).getByRole("button", { name: "Refreshing Manager Read" })).toBeDisabled();
    } else {
      expect(room).toHaveTextContent(statusLabel);
      expect(room).toHaveTextContent(safeMessage);
    }
    expect(room).not.toHaveTextContent("OpenAI");'''
shell = shell.replace(old_prior_assert, new_prior_assert)
shell_path.write_text(shell)

# Share intentionally surfaces drafts for owner preview; Release Narrative remains blocked.
share_path = Path('src/music-share-internal-narrative.test.ts')
share = share_path.read_text()
share = share.replace('it("keeps Manager drafts with unresolved review state out of packages", () => {\n    expect(isShareableSongDocument(document({ reviewState: "needs_review" }))).toBe(false);\n  });', 'it("keeps Manager drafts available for explicit owner preview", () => {\n    expect(isShareableSongDocument(document({ reviewState: "needs_review" }))).toBe(true);\n  });')
share_path.write_text(share)
