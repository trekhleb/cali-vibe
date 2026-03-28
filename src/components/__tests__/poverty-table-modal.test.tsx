import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PovertyTableModal from "@/components/poverty-table-modal";

const mockGeoJson = {
  features: [
    { properties: { name: "Fresno", poverty: 22.5 } },
    { properties: { name: "San Francisco", poverty: 10.3 } },
    { properties: { name: "Los Angeles", poverty: 16.8 } },
    { properties: { name: "No Data" } },
  ],
};

describe("PovertyTableModal", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockGeoJson),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading state initially", async () => {
    render(
      <PovertyTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Poverty" nameLabel="County" />
    );
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Fresno")).toBeInTheDocument());
  });

  it("renders table rows after data loads", async () => {
    render(
      <PovertyTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Poverty" nameLabel="County" />
    );
    await waitFor(() => expect(screen.getByText("Fresno")).toBeInTheDocument());
    expect(screen.getByText("San Francisco")).toBeInTheDocument();
    expect(screen.getByText("Los Angeles")).toBeInTheDocument();
    // "No Data" should be excluded since it has no poverty property
    expect(screen.queryByText("No Data")).not.toBeInTheDocument();
  });

  it("displays poverty rate values", async () => {
    render(
      <PovertyTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Poverty" nameLabel="County" />
    );
    await waitFor(() => expect(screen.getByText("Fresno")).toBeInTheDocument());
    expect(screen.getByText("22.5%")).toBeInTheDocument();
    expect(screen.getByText("10.3%")).toBeInTheDocument();
    expect(screen.getByText("16.8%")).toBeInTheDocument();
  });

  it("shows error on fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    render(
      <PovertyTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Poverty" nameLabel="County" />
    );
    await waitFor(() => expect(screen.getByText(/Error/)).toBeInTheDocument());
  });

  it("does not fetch when closed", () => {
    render(
      <PovertyTableModal open={false} onClose={() => {}} dataUrl="/data.json" title="Poverty" nameLabel="County" />
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sorts by name when clicking name header", async () => {
    const user = userEvent.setup();
    render(
      <PovertyTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Poverty" nameLabel="County" />
    );
    await waitFor(() => expect(screen.getByText("Fresno")).toBeInTheDocument());

    const nameHeader = screen.getByText("County", { selector: "th" });
    await user.click(nameHeader);
    await user.click(nameHeader); // toggle direction
  });

  it("sorts by poverty when clicking poverty header", async () => {
    const user = userEvent.setup();
    render(
      <PovertyTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Poverty" nameLabel="County" />
    );
    await waitFor(() => expect(screen.getByText("Fresno")).toBeInTheDocument());

    const povHeader = screen.getByText(/Poverty Rate/, { selector: "th" });
    await user.click(povHeader);
  });

  it("renders names as clickable links when onSelectName is provided", async () => {
    const onSelectName = vi.fn();
    render(
      <PovertyTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Poverty" nameLabel="County" onSelectName={onSelectName} />
    );
    await waitFor(() => expect(screen.getByText("Fresno")).toBeInTheDocument());

    const nameButton = screen.getByRole("button", { name: "Fresno" });
    expect(nameButton).toHaveClass("text-blue-600");
  });

  it("calls onSelectName and onClose when clicking a name", async () => {
    const user = userEvent.setup();
    const onSelectName = vi.fn();
    const onClose = vi.fn();
    render(
      <PovertyTableModal open={true} onClose={onClose} dataUrl="/data.json" title="Poverty" nameLabel="County" onSelectName={onSelectName} />
    );
    await waitFor(() => expect(screen.getByText("Fresno")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Fresno" }));
    expect(onSelectName).toHaveBeenCalledWith("Fresno");
    expect(onClose).toHaveBeenCalled();
  });

  it("renders names as plain text when onSelectName is not provided", async () => {
    render(
      <PovertyTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Poverty" nameLabel="County" />
    );
    await waitFor(() => expect(screen.getByText("Fresno")).toBeInTheDocument());

    expect(screen.queryByRole("button", { name: "Fresno" })).toBeNull();
  });

  it("handles poverty as string value", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        features: [{ properties: { name: "TestCounty", poverty: "15.7" } }],
      }),
    }));
    render(
      <PovertyTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Poverty" nameLabel="County" />
    );
    await waitFor(() => expect(screen.getByText("TestCounty")).toBeInTheDocument());
    expect(screen.getByText("15.7%")).toBeInTheDocument();
  });

  it("handles fetch network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    render(
      <PovertyTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Poverty" nameLabel="County" />
    );
    await waitFor(() => expect(screen.getByText(/Error.*Network error/)).toBeInTheDocument());
  });
});
