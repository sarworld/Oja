import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalorieRing } from "./CalorieRing";

describe("CalorieRing", () => {
  it("shows the rounded value and goal", () => {
    render(<CalorieRing value={1234.6} goal={2000} />);
    expect(screen.getByText("1235")).toBeInTheDocument();
    expect(screen.getByText("/ 2000 kcal")).toBeInTheDocument();
  });

  it("reports remaining calories when under goal", () => {
    render(<CalorieRing value={1500} goal={2000} />);
    expect(screen.getByText("500 left")).toBeInTheDocument();
  });

  it("reports overage when above goal", () => {
    render(<CalorieRing value={2300} goal={2000} />);
    expect(screen.getByText("300 over")).toBeInTheDocument();
  });

  it("has an accessible label describing progress", () => {
    render(<CalorieRing value={800} goal={2000} />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      "800 of 2000 kcal",
    );
  });

  it("does not divide by zero when goal is 0", () => {
    // Should render without throwing and treat goal as 1 internally.
    expect(() => render(<CalorieRing value={500} goal={0} />)).not.toThrow();
    expect(screen.getByText("500")).toBeInTheDocument();
  });

  it("caps the arc but still shows true over value", () => {
    // ratio > 1 → arc clamps to full but the displayed number is exact.
    render(<CalorieRing value={4000} goal={2000} />);
    expect(screen.getByText("4000")).toBeInTheDocument();
    expect(screen.getByText("2000 over")).toBeInTheDocument();
  });
});
