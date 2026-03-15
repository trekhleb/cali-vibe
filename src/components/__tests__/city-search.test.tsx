import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GeoSearch from "@/components/city-search";
import { fetchJsonCached } from "@/utils/fetch-json";

vi.mock("@/utils/fetch-json", () => ({
  fetchJsonCached: vi.fn(),
}));

const mockData = {
  features: [
    { properties: { name: "San Francisco" } },
    { properties: { name: "San Jose" } },
    { properties: { name: "Santa Cruz" } },
    { properties: { name: "Los Angeles" } },
  ],
};

describe("GeoSearch", () => {
  const onSelect = vi.fn();

  beforeEach(() => {
    onSelect.mockClear();
    (fetchJsonCached as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("renders search input", async () => {
    render(<GeoSearch dataUrl="/data.json" onSelect={onSelect} placeholder="Search..." />);
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
    await waitFor(() => expect(fetchJsonCached).toHaveBeenCalled());
  });

  it("filters suggestions on typing", async () => {
    render(<GeoSearch dataUrl="/data.json" onSelect={onSelect} placeholder="Search..." />);

    // Wait for data to load
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const input = screen.getByPlaceholderText("Search...");
    await userEvent.type(input, "San");

    await waitFor(() => {
      expect(screen.getByRole("list")).toBeInTheDocument();
    });
    // Suggestions should contain "San" matches
    const items = screen.getAllByRole("listitem");
    expect(items.length).toBeGreaterThan(0);
  });

  it("renders input with custom placeholder", async () => {
    render(<GeoSearch dataUrl="/data.json" onSelect={onSelect} placeholder="Find a city..." />);
    expect(screen.getByPlaceholderText("Find a city...")).toBeInTheDocument();
    await waitFor(() => expect(fetchJsonCached).toHaveBeenCalled());
  });

  it("navigates and selects using keyboard", async () => {
    render(<GeoSearch dataUrl="/data.json" onSelect={onSelect} />);
    await waitFor(() => expect(fetchJsonCached).toHaveBeenCalled());

    const input = screen.getByPlaceholderText("Search...");
    
    // Type to show suggestions
    await userEvent.type(input, "San");
    
    // Wait for list to appear
    await waitFor(() => expect(screen.getByRole("list")).toBeInTheDocument());

    // First ArrowDown highlights first item
    await userEvent.keyboard("{ArrowDown}");
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveClass("bg-gray-100 text-black");

    // Second ArrowDown highlights second item
    await userEvent.keyboard("{ArrowDown}");
    expect(items[1]).toHaveClass("bg-gray-100 text-black");

    // ArrowUp goes back to first item
    await userEvent.keyboard("{ArrowUp}");
    expect(items[0]).toHaveClass("bg-gray-100 text-black");

    // ArrowUp on first item goes to last item
    await userEvent.keyboard("{ArrowUp}");
    expect(items[items.length - 1]).toHaveClass("bg-gray-100 text-black");

    // ArrowDown on last item goes to first item
    await userEvent.keyboard("{ArrowDown}");
    expect(items[0]).toHaveClass("bg-gray-100 text-black");

    // Enter selects the first item ("San Francisco")
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("San Francisco");

    // The query should be cleared and list hidden
    expect(input).toHaveValue("");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("closes suggestions on Escape", async () => {
    render(<GeoSearch dataUrl="/data.json" onSelect={onSelect} />);
    await waitFor(() => expect(fetchJsonCached).toHaveBeenCalled());

    const input = screen.getByPlaceholderText("Search...");
    await userEvent.type(input, "San");
    await waitFor(() => expect(screen.getByRole("list")).toBeInTheDocument());

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("selects item on mouse down", async () => {
    render(<GeoSearch dataUrl="/data.json" onSelect={onSelect} />);
    await waitFor(() => expect(fetchJsonCached).toHaveBeenCalled());

    const input = screen.getByPlaceholderText("Search...");
    await userEvent.type(input, "San");
    await waitFor(() => expect(screen.getByRole("list")).toBeInTheDocument());

    const items = screen.getAllByRole("listitem");
    
    // Mouse enter highlights
    await userEvent.hover(items[1]);
    expect(items[1]).toHaveClass("bg-gray-100 text-black");

    // Mouse down selects
    // Let's use fireEvent because userEvent.click fires mousedown, mouseup, click
    // And component uses onMouseDown to prevent blur
    fireEvent.mouseDown(items[1]);
    
    expect(onSelect).toHaveBeenCalledWith("San Jose");
  });

  it("ignores failed fetch gracefully", async () => {
    (fetchJsonCached as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Network Error"));
    render(<GeoSearch dataUrl="/data.json" onSelect={onSelect} />);
    // Should not crash, suggestions should remain empty
    const input = screen.getByPlaceholderText("Search...");
    await userEvent.type(input, "San");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("opens suggestions on ArrowDown when closed", async () => {
    render(<GeoSearch dataUrl="/data.json" onSelect={onSelect} />);
    await waitFor(() => expect(fetchJsonCached).toHaveBeenCalled());

    const input = screen.getByPlaceholderText("Search...");
    await userEvent.type(input, "San");
    await waitFor(() => expect(screen.getByRole("list")).toBeInTheDocument());

    // Close with escape
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();

    // Reopen with ArrowDown
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("list")).toBeInTheDocument();
  });

  it("closes suggestions when clicking outside", async () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <GeoSearch dataUrl="/data.json" onSelect={onSelect} />
      </div>
    );
    await waitFor(() => expect(fetchJsonCached).toHaveBeenCalled());

    const input = screen.getByPlaceholderText("Search...");
    await userEvent.type(input, "San");
    await waitFor(() => expect(screen.getByRole("list")).toBeInTheDocument());

    // Click outside
    await userEvent.click(screen.getByTestId("outside"));
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
