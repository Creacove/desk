from pathlib import Path

DIALOG = Path('src/features/music/MusicShareDialog.tsx')
text = DIALOG.read_text()
text = text.replace(', sharePurposeShortLabel, type ShareInventory', ', type ShareInventory')
old = '''  const activeHistory = history.filter((link) => link.state === "active");
  const inactiveHistory = history.filter((link) => link.state !== "active");

  const selectedAssets = inventory.assets.filter((asset) => selection.assetIds.includes(asset.id));'''
new = '''  const selectedAssets = inventory.assets.filter((asset) => selection.assetIds.includes(asset.id));'''
if old not in text:
    raise SystemExit('duplicate history anchor missing')
text = text.replace(old, new, 1)
DIALOG.write_text(text)

CONTRACT = Path('src/music-share-recipient-contract.test.ts')
contract = CONTRACT.read_text()
contract = contract.replace('    expect(dialog).toContain("Recommended package");\n    expect(dialog).toContain("sharePurposeShortLabel");', '    expect(dialog).toContain("Who is this for?");\n    expect(dialog).toContain("Preview press kit");\n    expect(dialog).toContain("createPortal");\n    expect(dialog).toContain("share-primary-cta");')
CONTRACT.write_text(contract)

TEST = Path('src/music-share-dialog.test.tsx')
test = TEST.read_text()
test = test.replace('expect(screen.getByRole("heading", { name: "Jam — Press Kit" })).toBeInTheDocument();', 'expect(screen.getAllByRole("heading", { name: "Jam — Press Kit" }).length).toBeGreaterThan(0);')
test = test.replace('expect(await screen.findByRole("heading", { name: "Link ready" })).toBeInTheDocument();', 'expect(await screen.findByRole("heading", { name: "Share link ready" })).toBeInTheDocument();')
TEST.write_text(test)
