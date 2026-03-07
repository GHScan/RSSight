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
    expect(screen.getByRole("link", { name: "RSS 订阅" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "文章收藏" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "摘要设置" })).toBeInTheDocument();
  });
});
