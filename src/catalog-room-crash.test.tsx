import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const { thinkingOrbSpy } = vi.hoisted(() => ({ thinkingOrbSpy: vi.fn() }));

vi.mock("thinking-orbs", () => ({
  ThinkingOrb: (props: { size?: number; theme?: string }) => {
    thinkingOrbSpy(props);
    return <span data-testid="thinking-orb" data-size={String(props.size)} data-theme={props.theme} />;
  },
}));

import { AppThinkingOrb } from "./design-system/AppThinkingOrb";

describe("catalog room crash regression", () => {
  it("never passes an unsupported 18px preset into thinking-orbs", () => {
    thinkingOrbSpy.mockClear();
    const view = render(<AppThinkingOrb state="composing" size={18} />);

    expect(thinkingOrbSpy.mock.calls.at(-1)?.[0]?.size).toBe(20);
    view.unmount();
  });

  it("preserves the supported 64px preset", () => {
    thinkingOrbSpy.mockClear();
    const view = render(<AppThinkingOrb state="working" size={64} />);

    expect(thinkingOrbSpy.mock.calls.at(-1)?.[0]?.size).toBe(64);
    view.unmount();
  });

  it("keeps Song Room and Project Room callsites on supported orb sizes", () => {
    const music = readFileSync("src/features/music/MusicScreens.tsx", "utf8");
    expect(music).not.toContain("size={18}");
    expect(music).toContain('state="composing" size={20}');
  });
});
