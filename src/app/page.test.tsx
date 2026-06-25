import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { Shell } from "../components/shell";

describe("Shell", () => {
  it("renders navigation and page title", () => {
    render(
      React.createElement(Shell, { title: "Test Screen", subtitle: "Subtitle", automationStatusBar: null }, React.createElement("p", null, "Body"))
    );

    expect(screen.getByText("GameLead Radar")).toBeInTheDocument();
    expect(screen.getByText("Leads")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Test Screen" })).toBeInTheDocument();
  });
});
