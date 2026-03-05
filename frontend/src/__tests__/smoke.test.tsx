import { render, screen } from "@testing-library/react";
import { App } from "../App";

describe("App smoke", () => {
  it("renders foundation banner", () => {
    render(<App />);
    expect(screen.getByText("WebRSSReader Foundation Ready")).toBeInTheDocument();
  });
});
