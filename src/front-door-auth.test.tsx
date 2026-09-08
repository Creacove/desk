import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FrontDoorAuthScreen } from "./features/onboarding/FrontDoorAuth";
import { createSupabaseAuthAdapter } from "./services/productionSupabase";
import type { SupabaseClient } from "@supabase/supabase-js";

afterEach(cleanup);

describe("FrontDoor human identity", () => {
  it("starts invitees in account creation with a locked email and keeps it locked when switching to sign in", async () => {
    render(
      <FrontDoorAuthScreen
        authAdapter={{ getSession: async () => ({ user: null }) }}
        onAuthenticated={vi.fn()}
        invitation={{
          invitedEmail: "member@example.com",
          preview: {
            teamName: "CBA · House 3",
            artistName: "Godwinton",
            invitedEmail: "member@example.com",
            operatingTitle: "Content & Social",
            responsibilityTags: ["Content planning", "Social publishing"],
            expiresAt: "2026-09-12T09:00:00.000Z",
          },
          emailRedirectTo: "/join#token=token",
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Create your account to join." })).toBeInTheDocument();
    expect(screen.getByLabelText("Your name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("member@example.com");
    expect(screen.getByLabelText("Email")).toHaveAttribute("readonly");
    expect(screen.getByText("CBA · House 3")).toBeInTheDocument();
    expect(screen.getByText("For Godwinton")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByRole("heading", { name: "Sign in to join." })).toBeInTheDocument();
    expect(screen.queryByLabelText("Your name")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("member@example.com");
    expect(screen.getByLabelText("Email")).toHaveAttribute("readonly");
  });

  it("requires a display name before submitting a new account", () => {
    const signUpWithPassword = vi.fn();

    render(
      <FrontDoorAuthScreen
        authAdapter={{
          getSession: async () => ({ user: null }),
          signUpWithPassword,
        }}
        onAuthenticated={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "operator@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "safe-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByLabelText("Name")).toBeRequired();
    expect(screen.getByLabelText("Name")).toBeInvalid();
    expect(signUpWithPassword).not.toHaveBeenCalled();
  });

  it("passes the human display name to the sign-up adapter", async () => {
    const signUpWithPassword = vi.fn().mockResolvedValue({
      user: { id: "user-1", email: "operator@example.com", displayName: "Amina Okafor" },
      message: "Account created.",
    });
    const onAuthenticated = vi.fn().mockResolvedValue(undefined);

    render(
      <FrontDoorAuthScreen
        authAdapter={{
          getSession: async () => ({ user: null }),
          signUpWithPassword,
        }}
        onAuthenticated={onAuthenticated}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: " Amina Okafor " } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "operator@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "safe-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(signUpWithPassword).toHaveBeenCalledWith({
      email: "operator@example.com",
      password: "safe-password",
      name: "Amina Okafor",
    }));
    expect(onAuthenticated).toHaveBeenCalledTimes(1);
  });

  it("rejects a whitespace-only display name before submitting", async () => {
    const signUpWithPassword = vi.fn().mockResolvedValue({ user: null, message: "Account created." });

    render(
      <FrontDoorAuthScreen
        authAdapter={{
          getSession: async () => ({ user: null }),
          signUpWithPassword,
        }}
        onAuthenticated={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "   " } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "operator@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "safe-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(signUpWithPassword).not.toHaveBeenCalled());
  });
});

describe("Supabase auth identity metadata", () => {
  it("sends the trimmed human name as Supabase auth metadata", async () => {
    const signUp = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1", email: "operator@example.com", user_metadata: { name: "Amina Okafor" } } },
      error: null,
    });
    const client = {
      auth: {
        getSession: vi.fn(),
        signUp,
      },
    } as unknown as SupabaseClient;

    const result = await createSupabaseAuthAdapter(client).signUpWithPassword!({
      email: "operator@example.com",
      password: "safe-password",
      name: " Amina Okafor ",
    });

    expect(signUp).toHaveBeenCalledWith({
      email: "operator@example.com",
      password: "safe-password",
      options: { data: { name: "Amina Okafor" } },
    });
    expect(result.user).toEqual({ id: "user-1", email: "operator@example.com", displayName: "Amina Okafor" });
  });
});
