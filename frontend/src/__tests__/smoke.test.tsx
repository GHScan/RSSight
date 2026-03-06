import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { App } from "../App";

describe("App smoke", () => {
  it("renders app title and navigation", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "RSSight" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "订阅管理" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "摘要配置" })).toBeInTheDocument();
  });
});
