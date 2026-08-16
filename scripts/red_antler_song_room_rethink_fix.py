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
music_path.write_text(music)

# Align stale interaction expectations with already-shipped navigation, Share, and Manager labels.
shell_path = Path('src/production-app-shell.test.tsx')
shell = shell_path.read_text()
shell = shell.replace('expect(onOpenCreatedWork).toHaveBeenCalledWith("music_item", "song-attach", "files");', 'expect(onOpenCreatedWork).toHaveBeenCalledWith("music_item", "song-attach", "files", undefined);')
shell = shell.replace('expect(onOpenCreatedWork).toHaveBeenCalledWith("music_item", "song-after-hours");', 'expect(onOpenCreatedWork).toHaveBeenCalledWith("music_item", "song-after-hours", undefined, undefined);')
shell = shell.replace('expect(screen.getByRole("dialog", { name: "Share Jam files" })).toBeInTheDocument();\n    expect(screen.getByLabelText("Final master")).toBeChecked();\n    fireEvent.click(await screen.findByRole("button", { name: "Manage links" }));', 'expect(screen.getByRole("dialog", { name: "Share Jam" })).toBeInTheDocument();\n    fireEvent.click(await screen.findByRole("button", { name: "Links" }));')
shell = shell.replace('fireEvent.click(screen.getByRole("button", { name: "Create link" }));\n    expect(await screen.findByRole("heading", { name: "Link ready" })).toBeInTheDocument();', 'fireEvent.click(await screen.findByRole("button", { name: "A&R / private listen" }));\n    fireEvent.click(screen.getByRole("button", { name: "Preview private listen" }));\n    fireEvent.click(await screen.findByRole("button", { name: "Create private link" }));\n    expect(await screen.findByRole("heading", { name: "Share link ready" })).toBeInTheDocument();')
shell = shell.replace('fireEvent.click(screen.getByRole("button", { name: "Revoke link" }));', 'fireEvent.click(screen.getByRole("button", { name: "Revoke" }));')
shell = shell.replace('expect(screen.getByText("This package is no longer accessible.")).toBeInTheDocument();', 'expect(screen.getByText("This package can no longer be opened.")).toBeInTheDocument();')
# In jsdom both responsive header variants are present; scope the Manager action to the mobile header.
shell = shell.replace('fireEvent.click(within(screen.getByTestId("music-song-detail")).getByRole("button", { name: "Chat with Manager" }));', 'fireEvent.click(within(screen.getByTestId("music-detail-mobile-top")).getByRole("button", { name: "Chat with Manager" }));')

# The old ReleaseWorkAttachment was intentionally removed. Active work is now one quiet mission row.
shell = shell.replace('const songLinkedWork = within(screen.getByTestId("music-song-detail")).getByRole("region", { name: "Work on this song" });\n    expect(songLinkedWork).toHaveTextContent("Push Signal Song");\n    expect(songLinkedWork).not.toHaveTextContent("Confirm launch lane.");\n\n    fireEvent.click(within(songLinkedWork).getByRole("button", { name: "Open mission Push Signal Song" }));', 'const songLinkedWork = within(screen.getByTestId("music-song-detail")).getByRole("region", { name: "Active work" });\n    expect(songLinkedWork).toHaveTextContent("Push Signal Song");\n    expect(songLinkedWork).not.toHaveTextContent("Confirm launch lane.");\n\n    fireEvent.click(within(songLinkedWork).getByRole("button", { name: "Push Signal Song" }));')
shell = shell.replace('const releaseWork = within(room).getByRole("region", { name: "Work on this song" });\n    expect(releaseWork).toHaveTextContent("Prepare Jam for release");\n    expect(releaseWork).not.toHaveTextContent("Add the current working audio");\n    expect(within(room).queryByText("Linked work")).not.toBeInTheDocument();\n    expect(within(room).queryByTestId("music-linked-conversation")).not.toBeInTheDocument();\n    fireEvent.click(within(releaseWork).getByRole("button", { name: "Chat with Manager" }));\n    expect(onOpenManager).toHaveBeenCalledWith(subject);\n    fireEvent.click(within(releaseWork).getByRole("button", { name: "Open mission Prepare Jam for release" }));\n    expect(onOpenMission).toHaveBeenCalledWith("mission-jam-release");\n\n    expect(onOpenManager).toHaveBeenCalledTimes(1);\n    expect(within(room).getByTestId("manager-read-copy")).toHaveTextContent(completeSongManagerRead.body.split("\\n")[0]);', 'const activeWork = within(room).getByRole("region", { name: "Active work" });\n    expect(activeWork).toHaveTextContent("Prepare Jam for release");\n    expect(activeWork).not.toHaveTextContent("Add the current working audio");\n    expect(within(room).queryByText("Linked work")).not.toBeInTheDocument();\n    expect(within(room).queryByTestId("music-linked-conversation")).not.toBeInTheDocument();\n    fireEvent.click(within(screen.getByTestId("music-detail-mobile-top")).getByRole("button", { name: "Chat with Manager" }));\n    expect(onOpenManager).toHaveBeenCalledWith(subject);\n    fireEvent.click(within(activeWork).getByRole("button", { name: "Prepare Jam for release" }));\n    expect(onOpenMission).toHaveBeenCalledWith("mission-jam-release");\n\n    expect(onOpenManager).toHaveBeenCalledTimes(1);\n    expect(within(room).getByTestId("song-room-overview-read")).toHaveTextContent(completeSongManagerRead.body.split("\\n")[0]);')

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
shell_path.write_text(shell)

# Share intentionally surfaces drafts for owner preview; Release Narrative remains blocked.
share_path = Path('src/music-share-internal-narrative.test.ts')
share = share_path.read_text()
share = share.replace('it("keeps Manager drafts with unresolved review state out of packages", () => {\n    expect(isShareableSongDocument(document({ reviewState: "needs_review" }))).toBe(false);\n  });', 'it("keeps Manager drafts available for explicit owner preview", () => {\n    expect(isShareableSongDocument(document({ reviewState: "needs_review" }))).toBe(true);\n  });')
share_path.write_text(share)
