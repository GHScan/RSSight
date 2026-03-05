import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { App } from "../App";

describe("Tailwind foundation", () => {
  it("app root uses design token class for background so tokens are available", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    const el = document.querySelector(".bg-background");
    expect(el).toBeInTheDocument();
  });

  it("existing app content still renders without regression", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getAllByText("WebRSSReader").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("link", { name: "订阅管理" }).length).toBeGreaterThanOrEqual(1);
  });
});
