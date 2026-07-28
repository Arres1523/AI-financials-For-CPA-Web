import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RegisterForm from "@/app/register/RegisterForm";

const mockSignIn = vi.fn();
const mockReplace = vi.fn();
const mockRefresh = vi.fn();
const mockFetch = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignIn(...args),
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, refresh: mockRefresh }),
}));

describe("RegisterForm", () => {
  beforeEach(() => {
    mockSignIn.mockReset();
    mockReplace.mockReset();
    mockRefresh.mockReset();
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });

  it("recovers when account creation fails unexpectedly", async () => {
    mockFetch.mockRejectedValue(new Error("network failed"));

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

  it("shows registration API errors and unlocks the form", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: "User already registered" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    );

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

  it("shows a useful fallback when registration returns an unreadable error", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: "{}" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      })
    );

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

  it("creates the account through the server API and signs the user in", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ userId: "user-id" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      })
    );
    mockSignIn.mockResolvedValue({ error: null });

    render(<RegisterForm />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: " miguel@example.com " },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "miguel@example.com",
          password: "password123",
          fullName: "",
        }),
      });
      expect(mockSignIn).toHaveBeenCalledWith({
        email: "miguel@example.com",
        password: "password123",
      });
      expect(mockReplace).toHaveBeenCalledWith("/");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
