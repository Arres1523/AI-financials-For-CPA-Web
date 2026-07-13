import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Page from "../src/app/page";

describe("Workflow wizard page", () => {
  it("shows the wizard header and step indicator", () => {
    render(<Page />);
    expect(screen.getByText("Annual Financial Workflow")).toBeTruthy();
    expect(screen.getByText("Company & Year")).toBeTruthy();
  });
});
