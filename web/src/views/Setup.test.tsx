import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../test/render";
import { Setup } from "./Setup";
import type { ConfigResponse } from "../lib/types";

vi.mock("../lib/api", () => ({
  ApiError: class ApiError extends Error {},
  onUnauthorized: () => () => {},
  api: {
    getConfig: vi.fn(),
    putConfig: vi.fn(),
    testImmich: vi.fn(),
    testVision: vi.fn(),
  },
}));

import { api } from "../lib/api";

function emptyConfig(): ConfigResponse {
  const blank = { set: false, locked: false };
  return {
    configured: false,
    fields: {
      immich_url: { ...blank },
      immich_api_key: { ...blank },
      immich_album: { ...blank },
      vision_provider: { ...blank },
      vision_base_url: { ...blank },
      vision_api_key: { ...blank },
      vision_model: { ...blank },
      poll_interval_minutes: { ...blank },
    },
  };
}

describe("Setup wizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getConfig).mockResolvedValue(emptyConfig());
  });

  it("loads albums after a successful Immich test and lets you pick one", async () => {
    vi.mocked(api.testImmich).mockResolvedValue({
      ok: true,
      albums: [
        { id: "a1", name: "Food", assetCount: 12 },
        { id: "a2", name: "Trips", assetCount: 3 },
      ],
    });

    renderWithProviders(<Setup />);

    // Wait for config to load (step 1 visible).
    const urlInput = await screen.findByPlaceholderText(
      "https://immich.example.com",
    );
    await userEvent.type(urlInput, "https://immich.test");
    await userEvent.type(screen.getByPlaceholderText("API key"), "secret-key");

    await userEvent.click(
      screen.getByRole("button", { name: /test & load albums/i }),
    );

    // Album dropdown appears with the returned albums.
    const select = await screen.findByRole("combobox");
    expect(screen.getByRole("option", { name: "Food (12)" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Trips (3)" }),
    ).toBeInTheDocument();

    // "Next" is disabled until an album is chosen.
    const next = screen.getByRole("button", { name: /next: vision/i });
    expect(next).toBeDisabled();
    await userEvent.selectOptions(select, "Food");
    expect(next).toBeEnabled();
  });

  it("auto-fills base URL and a model when a vision preset is selected", async () => {
    vi.mocked(api.testImmich).mockResolvedValue({
      ok: true,
      albums: [{ id: "a1", name: "Food", assetCount: 1 }],
    });

    renderWithProviders(<Setup />);

    // Drive through step 1.
    const urlInput = await screen.findByPlaceholderText(
      "https://immich.example.com",
    );
    await userEvent.type(urlInput, "https://immich.test");
    await userEvent.type(screen.getByPlaceholderText("API key"), "k");
    await userEvent.click(
      screen.getByRole("button", { name: /test & load albums/i }),
    );
    const albumSelect = await screen.findByRole("combobox");
    await userEvent.selectOptions(albumSelect, "Food");
    await userEvent.click(screen.getByRole("button", { name: /next: vision/i }));

    // Step 2: default preset (OpenAI) should have auto-filled base URL.
    const baseUrl = (await screen.findByPlaceholderText(
      "https://api.openai.com/v1",
    )) as HTMLInputElement;

    // Switch the provider preset to Groq → base URL + model update.
    const presetSelect = screen.getAllByRole("combobox")[0];
    await userEvent.selectOptions(presetSelect, "groq");

    await waitFor(() => {
      expect(baseUrl.value).toBe("https://api.groq.com/openai/v1");
    });
    const model = screen.getByPlaceholderText("gpt-4o-mini") as HTMLInputElement;
    expect(model.value).toBe("meta-llama/llama-4-scout-17b-16e-instruct");
  });

  it("keeps Save disabled until all essentials are present", async () => {
    vi.mocked(api.testImmich).mockResolvedValue({
      ok: true,
      albums: [{ id: "a1", name: "Food", assetCount: 1 }],
    });

    renderWithProviders(<Setup />);

    // Step 1.
    const urlInput = await screen.findByPlaceholderText(
      "https://immich.example.com",
    );
    await userEvent.type(urlInput, "https://immich.test");
    await userEvent.type(screen.getByPlaceholderText("API key"), "immich-key");
    await userEvent.click(
      screen.getByRole("button", { name: /test & load albums/i }),
    );
    const albumSelect = await screen.findByRole("combobox");
    await userEvent.selectOptions(albumSelect, "Food");
    await userEvent.click(screen.getByRole("button", { name: /next: vision/i }));

    // Step 2: model auto-fills from the default preset; add the vision key.
    const model = (await screen.findByPlaceholderText(
      "gpt-4o-mini",
    )) as HTMLInputElement;
    expect(model.value).toBe("gpt-4o-mini");

    // Before the key is entered, Next is disabled (key is an essential).
    const nextSave = screen.getByRole("button", { name: /next: save/i });
    expect(nextSave).toBeDisabled();

    await userEvent.type(screen.getByPlaceholderText("API key"), "vision-key");
    expect(nextSave).toBeEnabled();
    await userEvent.click(nextSave);

    // Step 3: Save should now be enabled (all essentials present).
    const save = await screen.findByRole("button", { name: /save & finish/i });
    expect(save).toBeEnabled();
  });
});
