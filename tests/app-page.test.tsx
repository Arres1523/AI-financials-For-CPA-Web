import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Page from "../src/app/page";

describe("Annual CPA Package page", () => {
  it("shows the core workflow sections", () => {
    render(<Page />);
    expect(screen.getByText("Annual CPA Package")).toBeTruthy();
    expect(screen.getByText("Document Checklist")).toBeTruthy();
    expect(screen.getByText("Transaction Review")).toBeTruthy();
    expect(screen.getByText("Package Blockers")).toBeTruthy();
  });
});
