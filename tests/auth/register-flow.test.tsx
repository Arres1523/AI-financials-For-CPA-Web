import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RegisterForm from "@/app/register/RegisterForm";

const mockSignUp = vi.fn();
const mockReplace = vi.fn();
const mockRefresh = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, refresh: mockRefresh }),
}));

describe("RegisterForm", () => {
  beforeEach(() => {
    mockSignUp.mockReset();
    mockReplace.mockReset();
    mockRefresh.mockReset();
  });

  it("recovers when account creation fails unexpectedly", async () => {
    mockSignUp.mockRejectedValue(new Error("network failed"));

    render(<RegisterForm />);
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Miguel" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "miguel@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /create account/i }));

    expect((screen.getByRole("button", { name: /creating account/i }) as HTMLButtonElement).disabled).toBe(true);

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("network failed");
      expect((screen.getByRole("button", { name: /create account/i }) as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it("shows Supabase sign-up errors and unlocks the form", async () => {
    mockSignUp.mockResolvedValue({
      data: { session: null },
      error: { message: "User already registered" },
    });

    render(<RegisterForm />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "miguel@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText("User already registered")).toBeDefined();
      expect((screen.getByRole("button", { name: /create account/i }) as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it("shows a useful fallback when Supabase returns an unreadable sign-up error", async () => {
    mockSignUp.mockResolvedValue({
      data: { session: null },
      error: { message: {} },
    });

    render(<RegisterForm />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "miguel@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(
        "Account creation failed. Check your connection and Supabase Auth settings, then try again."
      );
      expect((screen.getByRole("button", { name: /create account/i }) as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it("redirects authenticated sign-ups to the app", async () => {
    mockSignUp.mockResolvedValue({
      data: { session: { access_token: "token" } },
      error: null,
    });

    render(<RegisterForm />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "miguel@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
