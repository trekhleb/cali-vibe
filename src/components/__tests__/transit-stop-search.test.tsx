import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TransitStopSearch from "@/components/transit-stop-search";
import { fetchJsonCached } from "@/utils/fetch-json";

vi.mock("@/utils/fetch-json", () => ({
  fetchJsonCached: vi.fn(),
}));

const mockStopsData = {
  features: [
    {
      properties: {
        name: "Embarcadero",
        colors: ["#FF0000", "#FF9933", "#FFFF33"],
      },
    },
    {
      properties: {
        name: "Powell Street",
        colors: ["#FF0000", "#FF9933", "#FFFF33"],
      },
    },
    {
      properties: {
        name: "Richmond",
        colors: ["#FF0000", "#FF9933"],
      },
    },
    {
      properties: {
        name: "12th Street / Oakland City Center",
        colors: ["#FF0000"],
      },
    },
    {
      properties: {
        name: "El Cerrito Del Norte",
        colors: ["#FF9933", "#FF0000"],
      },
    },
  ],
};

describe("TransitStopSearch", () => {
  const onSelect = vi.fn();

  beforeEach(() => {
    onSelect.mockClear();
    (fetchJsonCached as ReturnType<typeof vi.fn>).mockResolvedValue(mockStopsData);
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("renders input with placeholder", async () => {
    render(
      <TransitStopSearch dataUrl="/stops.json" onSelect={onSelect} placeholder="Search BART stations..." />,
    );
    expect(screen.getByPlaceholderText("Search BART stations...")).toBeInTheDocument();
    await waitFor(() => expect(fetchJsonCached).toHaveBeenCalledWith("/stops.json"));
  });

  it("uses default placeholder when not specified", async () => {
    render(<TransitStopSearch dataUrl="/stops.json" onSelect={onSelect} />);
    expect(screen.getByPlaceholderText("Search stations...")).toBeInTheDocument();
    await waitFor(() => expect(fetchJsonCached).toHaveBeenCalled());
  });

  it("fetches data from provided URL on mount", async () => {
    render(<TransitStopSearch dataUrl="/my-stops.json" onSelect={onSelect} />);
    await waitFor(() => expect(fetchJsonCached).toHaveBeenCalledWith("/my-stops.json"));
  });

  it("filters suggestions as user types", async () => {
    render(<TransitStopSearch dataUrl="/stops.json" onSelect={onSelect} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const input = screen.getByPlaceholderText("Search stations...");
    await userEvent.type(input, "Ric");

    await waitFor(() => {
      expect(screen.getByRole("list")).toBeInTheDocument();
    });
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(screen.getByText(/Ric/)).toBeInTheDocument();
  });

  it("shows multiple matching results", async () => {
    render(<TransitStopSearch dataUrl="/stops.json" onSelect={onSelect} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const input = screen.getByPlaceholderText("Search stations...");
    await userEvent.type(input, "el");

    await waitFor(() => {
      expect(screen.getByRole("list")).toBeInTheDocument();
    });
    const items = screen.getAllByRole("listitem");
    // "Powell Street" and "El Cerrito Del Norte" both contain "el"
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it("limits suggestions to 8 results", async () => {
    // Create mock with many matching stops
    const manyStops = {
      features: Array.from({ length: 15 }, (_, i) => ({
        properties: { name: `Station ${i}`, colors: ["#FF0000"] },
      })),
    };
    (fetchJsonCached as ReturnType<typeof vi.fn>).mockResolvedValue(manyStops);

    render(<TransitStopSearch dataUrl="/stops.json" onSelect={onSelect} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const input = screen.getByPlaceholderText("Search stations...");
    await userEvent.type(input, "Station");

    await waitFor(() => {
      expect(screen.getByRole("list")).toBeInTheDocument();
    });
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(8);
  });

  it("shows no suggestions for non-matching query", async () => {
    render(<TransitStopSearch dataUrl="/stops.json" onSelect={onSelect} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const input = screen.getByPlaceholderText("Search stations...");
    await userEvent.type(input, "zzzzz");

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("shows no suggestions for empty query", async () => {
    render(<TransitStopSearch dataUrl="/stops.json" onSelect={onSelect} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  // ── Selection ──

  it("selects item on mouse down and clears query", async () => {
    render(<TransitStopSearch dataUrl="/stops.json" onSelect={onSelect} />);
    await waitFor(() => expect(fetchJsonCached).toHaveBeenCalled());

    const input = screen.getByPlaceholderText("Search stations...");
    await userEvent.type(input, "Ric");
    await waitFor(() => expect(screen.getByRole("list")).toBeInTheDocument());

    const items = screen.getAllByRole("listitem");
    fireEvent.mouseDown(items[0]);

    expect(onSelect).toHaveBeenCalledWith("Richmond");
    expect(input).toHaveValue("");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  // ── Keyboard navigation ──

  it("navigates with arrow keys and selects with Enter", async () => {
    render(<TransitStopSearch dataUrl="/stops.json" onSelect={onSelect} />);
    await waitFor(() => expect(fetchJsonCached).toHaveBeenCalled());

    const input = screen.getByPlaceholderText("Search stations...");
    await userEvent.type(input, "el");
    await waitFor(() => expect(screen.getByRole("list")).toBeInTheDocument());

    // ArrowDown highlights first
    await userEvent.keyboard("{ArrowDown}");
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveClass("bg-gray-100");

    // ArrowDown highlights second
    await userEvent.keyboard("{ArrowDown}");
    expect(items[1]).toHaveClass("bg-gray-100");

    // ArrowUp goes back
    await userEvent.keyboard("{ArrowUp}");
    expect(items[0]).toHaveClass("bg-gray-100");

    // Enter selects
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue("");
  });

  it("wraps around on ArrowDown past last item", async () => {
    render(<TransitStopSearch dataUrl="/stops.json" onSelect={onSelect} />);
    await waitFor(() => expect(fetchJsonCached).toHaveBeenCalled());

    const input = screen.getByPlaceholderText("Search stations...");
    await userEvent.type(input, "Ric");
    await waitFor(() => expect(screen.getByRole("list")).toBeInTheDocument());

    // Only 1 result; ArrowDown twice should wrap to first
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{ArrowDown}");
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveClass("bg-gray-100");
  });

  it("wraps around on ArrowUp past first item", async () => {
    render(<TransitStopSearch dataUrl="/stops.json" onSelect={onSelect} />);
    await waitFor(() => expect(fetchJsonCached).toHaveBeenCalled());

    const input = screen.getByPlaceholderText("Search stations...");
    await userEvent.type(input, "el");
    await waitFor(() => expect(screen.getByRole("list")).toBeInTheDocument());

    // ArrowDown to highlight index 0, then ArrowUp wraps to last item
    await userEvent.keyboard("{ArrowDown}");
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveClass("bg-gray-100");

    await userEvent.keyboard("{ArrowUp}");
    expect(items[items.length - 1]).toHaveClass("bg-gray-100");
  });

  it("closes suggestions on Escape", async () => {
    render(<TransitStopSearch dataUrl="/stops.json" onSelect={onSelect} />);
    await waitFor(() => expect(fetchJsonCached).toHaveBeenCalled());

    const input = screen.getByPlaceholderText("Search stations...");
    await userEvent.type(input, "Ric");
    await waitFor(() => expect(screen.getByRole("list")).toBeInTheDocument());

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("reopens suggestions on ArrowDown when closed", async () => {
    render(<TransitStopSearch dataUrl="/stops.json" onSelect={onSelect} />);
    await waitFor(() => expect(fetchJsonCached).toHaveBeenCalled());

    const input = screen.getByPlaceholderText("Search stations...");
    await userEvent.type(input, "Ric");
    await waitFor(() => expect(screen.getByRole("list")).toBeInTheDocument());

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();

    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("list")).toBeInTheDocument();
  });

  it("highlights mouse-hovered item", async () => {
    render(<TransitStopSearch dataUrl="/stops.json" onSelect={onSelect} />);
    await waitFor(() => expect(fetchJsonCached).toHaveBeenCalled());

    const input = screen.getByPlaceholderText("Search stations...");
    await userEvent.type(input, "el");
    await waitFor(() => expect(screen.getByRole("list")).toBeInTheDocument());

    const items = screen.getAllByRole("listitem");
    await userEvent.hover(items[1]);
    expect(items[1]).toHaveClass("bg-gray-100");
  });

  // ── Click outside ──

  it("closes suggestions when clicking outside", async () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <TransitStopSearch dataUrl="/stops.json" onSelect={onSelect} />
      </div>,
    );
    await waitFor(() => expect(fetchJsonCached).toHaveBeenCalled());

    const input = screen.getByPlaceholderText("Search stations...");
    await userEvent.type(input, "Ric");
    await waitFor(() => expect(screen.getByRole("list")).toBeInTheDocument());

    await userEvent.click(screen.getByTestId("outside"));
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  // ── Refocus ──

  it("reopens suggestions on focus when query is non-empty", async () => {
    render(<TransitStopSearch dataUrl="/stops.json" onSelect={onSelect} />);
    await waitFor(() => expect(fetchJsonCached).toHaveBeenCalled());

    const input = screen.getByPlaceholderText("Search stations...");
    await userEvent.type(input, "Ric");
    await waitFor(() => expect(screen.getByRole("list")).toBeInTheDocument());

    // Close
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();

    // Refocus — use fireEvent.focus to directly trigger the onFocus handler
    fireEvent.focus(input);
    expect(screen.getByRole("list")).toBeInTheDocument();
  });

  // ── Error handling ──

  it("handles fetch failure gracefully", async () => {
    (fetchJsonCached as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Network Error"));
    render(<TransitStopSearch dataUrl="/stops.json" onSelect={onSelect} />);

    const input = screen.getByPlaceholderText("Search stations...");
    await userEvent.type(input, "Ric");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  // ── Color indicators ──

  it("displays color indicators for each stop", async () => {
    render(<TransitStopSearch dataUrl="/stops.json" onSelect={onSelect} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const input = screen.getByPlaceholderText("Search stations...");
    await userEvent.type(input, "Embarcadero");

    await waitFor(() => {
      expect(screen.getByRole("list")).toBeInTheDocument();
    });

    // Embarcadero has 3 colors — should have 3 colored dots
    const item = screen.getByRole("listitem");
    const dots = item.querySelectorAll("span.rounded-full");
    expect(dots).toHaveLength(3);
  });

  // ── Highlight match ──

  it("highlights matching text in suggestions", async () => {
    render(<TransitStopSearch dataUrl="/stops.json" onSelect={onSelect} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const input = screen.getByPlaceholderText("Search stations...");
    await userEvent.type(input, "rich");

    await waitFor(() => {
      expect(screen.getByRole("list")).toBeInTheDocument();
    });

    const boldMatch = screen.getByText("Rich");
    expect(boldMatch.tagName).toBe("SPAN");
    expect(boldMatch).toHaveClass("font-bold");
  });
});
