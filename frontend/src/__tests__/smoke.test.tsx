import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "../App";

describe("App smoke", () => {
  it("renders foundation banner", () => {
    render(<App />);
    expect(
      screen.getByText("WebRSSReader 基础骨架已就绪"),
    ).toBeInTheDocument();
  });
});
