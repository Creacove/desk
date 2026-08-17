from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}')
    target.write_text(text.replace(old, new, 1))


replace_once(
    'src/release-success-conversation.test.tsx',
    '''  it("renders a playlist servicing decision with inspectable provenance and manual outcome", () => {
    const onPreparePitch = vi.fn();
    const onRecordOutcome = vi.fn();
    const onOpenFiles = vi.fn();
    render(<OpportunityArtifact artifact={playlistArtifact} onPreparePitch={onPreparePitch} onRecordOutcome={onRecordOutcome} onOpenFiles={onOpenFiles} onRetry={vi.fn()} />);

    const card = screen.getByTestId("release-opportunity-artifact");
    expect(card).toHaveTextContent("PITCH NOW");
    expect(screen.getByRole("heading", { name: "6 playlist opportunities worth pitching now" })).toBeInTheDocument();
    expect(card).toHaveTextContent("Pitch now");
    expect(card).toHaveTextContent("Watch");
    expect(card).toHaveTextContent("Skip");
    expect(card).not.toHaveTextContent("Night Drive 1");
    fireEvent.click(screen.getByRole("button", { name: "Review targets" }));
    expect(card).toHaveTextContent("Night Drive 1");
    expect(card).toHaveTextContent("Source evidence");
    expect(card).toHaveTextContent("Contact route");
    expect(card).toHaveTextContent("The song's nocturnal hook matches the playlist's stated lane.");
    expect(card).toHaveTextContent("high confidence");
    expect(card).toHaveTextContent("Public route only; placement is not guaranteed.");
    expect(screen.getByRole("link", { name: "Open source for Night Drive 1" })).toHaveAttribute("rel", "noreferrer");

    fireEvent.click(screen.getByRole("button", { name: "Open Night Drive 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Prepare pitch for Night Drive 1" }));
    expect(onPreparePitch).toHaveBeenCalledWith(expect.objectContaining({ id: "playlist-1" }));
    fireEvent.click(screen.getByRole("button", { name: "Record outcome for Night Drive 1" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Outcome note for Night Drive 1" }), { target: { value: "Artist submitted manually." } });
    fireEvent.click(screen.getByRole("button", { name: "Save outcome for Night Drive 1" }));
    expect(onRecordOutcome).toHaveBeenCalledWith(expect.objectContaining({ id: "playlist-1" }), expect.objectContaining({ manualOutcome: "Artist submitted manually." }));
    expect(onOpenFiles).not.toHaveBeenCalled();
  });''',
    '''  it("renders playlist opportunities as a direct, inspectable result with manual outcome", () => {
    const onPreparePitch = vi.fn();
    const onRecordOutcome = vi.fn();
    const onOpenFiles = vi.fn();
    render(<OpportunityArtifact artifact={playlistArtifact} onPreparePitch={onPreparePitch} onRecordOutcome={onRecordOutcome} onOpenFiles={onOpenFiles} onRetry={vi.fn()} />);

    const card = screen.getByTestId("release-opportunity-artifact");
    expect(screen.getByRole("heading", { name: "6 targets are ready to pitch" })).toBeInTheDocument();
    expect(card).toHaveTextContent("Night Drive 1");
    expect(card).toHaveTextContent("Watchlist target");
    expect(card).not.toHaveTextContent("PITCH NOW");
    expect(screen.queryByRole("button", { name: "Review targets" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open Night Drive 1" }));
    expect(card).toHaveTextContent("The song's nocturnal hook matches the playlist's stated lane.");
    expect(card).toHaveTextContent("high confidence");
    expect(card).toHaveTextContent("Public route only; placement is not guaranteed.");
    expect(screen.getByRole("link", { name: "View source" })).toHaveAttribute("rel", "noreferrer");

    fireEvent.click(screen.getByRole("button", { name: "Prepare pitch" }));
    expect(onPreparePitch).toHaveBeenCalledWith(expect.objectContaining({ id: "playlist-1" }));
    fireEvent.click(screen.getByRole("button", { name: "Record outcome" }));
    fireEvent.change(screen.getByPlaceholderText("Add a short note"), { target: { value: "Artist submitted manually." } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onRecordOutcome).toHaveBeenCalledWith(expect.objectContaining({ id: "playlist-1" }), expect.objectContaining({ manualOutcome: "Artist submitted manually." }));
    expect(onOpenFiles).not.toHaveBeenCalled();
  });''',
)

replace_once(
    'src/release-success-conversation.test.tsx',
    '''    fireEvent.click(screen.getByRole("button", { name: "Review targets" }));
    expect(screen.getByText("Spotify editorial handoff")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Spotify for Artists" })).toHaveAttribute("href", "https://artists.spotify.com/c/artist/submit");
    expect(screen.queryByText(/editor@|spotify editor email/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Send/i })).not.toBeInTheDocument();''',
    '''    fireEvent.click(screen.getByRole("button", { name: "Open Spotify Editorial Playlist" }));
    expect(screen.getByText("Spotify editorial pitches go through Spotify for Artists. Manager will prepare the pitch, not submit it for you.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open submission route" })).toHaveAttribute("href", "https://artists.spotify.com/c/artist/submit");
    expect(screen.queryByText(/editor@|spotify editor email/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Send/i })).not.toBeInTheDocument();''',
)

replace_once(
    'src/release-success-conversation.test.tsx',
    '''    fireEvent.click(screen.getByRole("button", { name: "Review targets" }));
    expect(screen.getByText("Target package")).toBeInTheDocument();
    expect(screen.getByText("EPK")).toBeInTheDocument();
    expect(screen.getByText("Personalized press pitch")).toBeInTheDocument();
    expect(screen.getByText("A copyable song-specific pitch.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy pitch" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open share link" })).toHaveAttribute("href", "https://desk.ordersounds.com/share/package-1");
    expect(screen.getByText("One contact route still needs verification.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry contact verification" }));
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ id: "opportunities:song-1:playlist" }));
    expect(screen.queryByRole("button", { name: /Send/i })).not.toBeInTheDocument();''',
    '''    fireEvent.click(screen.getByRole("button", { name: "Open Night Drive 1" }));
    expect(screen.getByText("Pitch draft")).toBeInTheDocument();
    expect(screen.getByText("A copyable song-specific pitch.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open share link" })).toHaveAttribute("href", "https://desk.ordersounds.com/share/package-1");
    expect(screen.getByText("One contact route still needs verification.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ id: "opportunities:song-1:playlist" }));
    expect(screen.queryByRole("button", { name: /Send/i })).not.toBeInTheDocument();''',
)

replace_once(
    'src/manager-interruption-ui.test.tsx',
    '''    expect(screen.getByText("Action required")).toBeInTheDocument();
    expect(screen.getByText("Approved cover artwork is missing.")).toBeInTheDocument();''',
    '''    expect(screen.queryByText("Action required")).not.toBeInTheDocument();
    expect(screen.getByText("Approved cover artwork is missing.")).toBeInTheDocument();''',
)

print('Migrated legacy Manager artifact tests to the premium direct-result contract.')
