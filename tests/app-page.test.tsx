import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeAll } from "vitest";
import Page from "../src/app/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

beforeAll(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } })
    )
  );
});

describe("Workflow wizard page", () => {
  it("shows the wizard header and step indicator", async () => {
    render(<Page />);
    expect(await screen.findByText("Annual Financial Workflow")).toBeTruthy();
    expect(await screen.findByText("Company & Year")).toBeTruthy();
  });
});
