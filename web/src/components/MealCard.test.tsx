import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/render";
import { MealCard } from "./MealCard";
import type { Entry } from "../lib/types";

// Mock the whole API layer so MealCard's mutation hooks don't hit the network.
vi.mock("../lib/api", () => ({
  onUnauthorized: () => () => {},
  api: {
    toggle: vi.fn(),
    patch: vi.fn(),
    reanalyze: vi.fn(),
    chat: vi.fn(),
    remove: vi.fn(),
  },
  photoUrl: (id: string) => `/api/photo/${id}`,
}));

import { api } from "../lib/api";

const entry: Entry = {
  id: 1,
  immich_asset_id: "asset-1",
  taken_at: "2026-06-24T12:00:00Z",
  day: "2026-06-24",
  logged_at: "2026-06-24T12:01:00Z",
  dish: "Chicken rice bowl",
  items: [
    { name: "Grilled chicken", kcal: 220, protein_g: 35, carbs_g: 0, fat_g: 8 },
    { name: "White rice", kcal: 200, protein_g: 4, carbs_g: 44, fat_g: 0 },
    { name: "Broccoli", kcal: 35, protein_g: 3, carbs_g: 7, fat_g: 0 },
  ],
  kcal: 455,
  protein_g: 42,
  carbs_g: 51,
  fat_g: 8,
  confidence: "high",
  notes: "",
  included: true,
  edited: false,
  source: "auto",
};

describe("MealCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the dish, total, and per-item breakdown", () => {
    renderWithProviders(<MealCard entry={entry} date="2026-06-24" />);

    expect(screen.getByText("Chicken rice bowl")).toBeInTheDocument();
    expect(screen.getByText("455")).toBeInTheDocument();

    // Each item name + its kcal appears in the breakdown.
    expect(screen.getByText("Grilled chicken")).toBeInTheDocument();
    expect(screen.getByText("220 kcal")).toBeInTheDocument();
    expect(screen.getByText("White rice")).toBeInTheDocument();
    expect(screen.getByText("200 kcal")).toBeInTheDocument();
    expect(screen.getByText("Broccoli")).toBeInTheDocument();
    expect(screen.getByText("35 kcal")).toBeInTheDocument();
  });

  it("shows 'Counted' when included", () => {
    renderWithProviders(<MealCard entry={entry} date="2026-06-24" />);
    expect(screen.getByText("Counted")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("shows 'Excluded' for an excluded entry", () => {
    renderWithProviders(
      <MealCard entry={{ ...entry, included: false }} date="2026-06-24" />,
    );
    expect(screen.getByText("Excluded")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("calls the toggle API when the include switch is flipped", async () => {
    vi.mocked(api.toggle).mockResolvedValue({ included: false });
    renderWithProviders(<MealCard entry={entry} date="2026-06-24" />);

    await userEvent.click(screen.getByRole("checkbox"));

    await waitFor(() => {
      expect(api.toggle).toHaveBeenCalledWith(1);
    });
  });
});
