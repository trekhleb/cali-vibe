import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EducationTableModal from "@/components/education-table-modal";

const mockGeoJson = {
  features: [
    { properties: { name: "San Francisco", education: { bachPlus: 58.3, hsPlus: 88.1, gradPlus: 24.5 } } },
    { properties: { name: "Imperial", education: { bachPlus: 14.2, hsPlus: 65.3, gradPlus: 4.8 } } },
    { properties: { name: "Alameda", education: { bachPlus: 48.2, hsPlus: 89.5, gradPlus: 20.1 } } },
    { properties: { name: "Alpine", education: { bachPlus: 28.0, hsPlus: 92.0, gradPlus: null } } },
    { properties: { name: "No Education" } },
  ],
};

describe("EducationTableModal", () => {
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
      <EducationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Education" nameLabel="County" activeEducationMetric="bachPlus" />
    );
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("San Francisco")).toBeInTheDocument());
  });

  it("renders table rows after data loads", async () => {
    render(
      <EducationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Education" nameLabel="County" activeEducationMetric="bachPlus" />
    );
    await waitFor(() => expect(screen.getByText("San Francisco")).toBeInTheDocument());
    expect(screen.getByText("Imperial")).toBeInTheDocument();
    expect(screen.getByText("Alameda")).toBeInTheDocument();
    expect(screen.getByText("Alpine")).toBeInTheDocument();
  });

  it("skips features without education data", async () => {
    render(
      <EducationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Education" nameLabel="County" activeEducationMetric="bachPlus" />
    );
    await waitFor(() => expect(screen.getByText("San Francisco")).toBeInTheDocument());
    expect(screen.queryByText("No Education")).not.toBeInTheDocument();
  });

  it("formats values as percentages", async () => {
    render(
      <EducationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Education" nameLabel="County" activeEducationMetric="bachPlus" />
    );
    await waitFor(() => expect(screen.getByText("San Francisco")).toBeInTheDocument());
    expect(screen.getByText("58.3%")).toBeInTheDocument();
    expect(screen.getByText("14.2%")).toBeInTheDocument();
  });

  it("shows dash for null values", async () => {
    render(
      <EducationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Education" nameLabel="County" activeEducationMetric="gradPlus" />
    );
    await waitFor(() => expect(screen.getByText("Alpine")).toBeInTheDocument());
    const alpineRow = screen.getByText("Alpine").closest("tr")!;
    expect(alpineRow.textContent).toContain("\u2014");
  });

  it("shows error on fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    render(
      <EducationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Education" nameLabel="County" activeEducationMetric="bachPlus" />
    );
    await waitFor(() => expect(screen.getByText(/Error/)).toBeInTheDocument());
  });

  it("shows error on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    render(
      <EducationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Education" nameLabel="County" activeEducationMetric="bachPlus" />
    );
    await waitFor(() => expect(screen.getByText(/Error.*Network error/)).toBeInTheDocument());
  });

  it("does not fetch when closed", () => {
    render(
      <EducationTableModal open={false} onClose={() => {}} dataUrl="/data.json" title="Education" nameLabel="County" activeEducationMetric="bachPlus" />
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sorts by name when clicking name header", async () => {
    const user = userEvent.setup();
    render(
      <EducationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Education" nameLabel="County" activeEducationMetric="bachPlus" />
    );
    await waitFor(() => expect(screen.getByText("San Francisco")).toBeInTheDocument());

    const nameHeader = screen.getByText("County", { selector: "th" });
    await user.click(nameHeader);

    const rows = screen.getAllByRole("row");
    expect(rows[1].textContent).toContain("Alameda");
  });

  it("toggles sort direction on repeated click", async () => {
    const user = userEvent.setup();
    render(
      <EducationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Education" nameLabel="County" activeEducationMetric="bachPlus" />
    );
    await waitFor(() => expect(screen.getByText("San Francisco")).toBeInTheDocument());

    const nameHeader = screen.getByText("County", { selector: "th" });
    await user.click(nameHeader); // asc
    await user.click(nameHeader); // desc
    const rows = screen.getAllByRole("row");
    expect(rows[1].textContent).toContain("San Francisco");
  });

  it("sorts by bachPlus column", async () => {
    const user = userEvent.setup();
    render(
      <EducationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Education" nameLabel="County" activeEducationMetric="bachPlus" />
    );
    await waitFor(() => expect(screen.getByText("San Francisco")).toBeInTheDocument());

    const bachHeader = screen.getByText(/Bachelor's\+/, { selector: "th" });
    await user.click(bachHeader); // toggle to asc
    const rows = screen.getAllByRole("row");
    expect(rows[1].textContent).toContain("Imperial");
  });

  it("syncs sort key when activeEducationMetric changes", async () => {
    const { rerender } = render(
      <EducationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Education" nameLabel="County" activeEducationMetric="bachPlus" />
    );
    await waitFor(() => expect(screen.getByText("San Francisco")).toBeInTheDocument());

    rerender(
      <EducationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Education" nameLabel="County" activeEducationMetric="hsPlus" />
    );

    // After rerender, hsPlus column should have highlight bg
    const hsCells = screen.getAllByText("89.5%");
    expect(hsCells[0].closest("td")).toHaveClass("bg-amber-50");
  });

  it("renders names as clickable links when onSelectName is provided", async () => {
    const onSelectName = vi.fn();
    render(
      <EducationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Education" nameLabel="County" activeEducationMetric="bachPlus" onSelectName={onSelectName} />
    );
    await waitFor(() => expect(screen.getByText("San Francisco")).toBeInTheDocument());

    const nameButton = screen.getByRole("button", { name: "San Francisco" });
    expect(nameButton).toBeInTheDocument();
    expect(nameButton).toHaveClass("text-blue-600");
  });

  it("calls onSelectName and onClose when clicking a name", async () => {
    const user = userEvent.setup();
    const onSelectName = vi.fn();
    const onClose = vi.fn();
    render(
      <EducationTableModal open={true} onClose={onClose} dataUrl="/data.json" title="Education" nameLabel="County" activeEducationMetric="bachPlus" onSelectName={onSelectName} />
    );
    await waitFor(() => expect(screen.getByText("San Francisco")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "San Francisco" }));
    expect(onSelectName).toHaveBeenCalledWith("San Francisco");
    expect(onClose).toHaveBeenCalled();
  });

  it("renders names as plain text when onSelectName is not provided", async () => {
    render(
      <EducationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Education" nameLabel="County" activeEducationMetric="bachPlus" />
    );
    await waitFor(() => expect(screen.getByText("San Francisco")).toBeInTheDocument());

    expect(screen.queryByRole("button", { name: "San Francisco" })).toBeNull();
  });

  it("handles education data as JSON string", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        features: [
          { properties: { name: "County X", education: JSON.stringify({ bachPlus: 35.0, hsPlus: 85.0, gradPlus: 15.0 }) } },
        ],
      }),
    }));
    render(
      <EducationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Education" nameLabel="County" activeEducationMetric="bachPlus" />
    );
    await waitFor(() => expect(screen.getByText("County X")).toBeInTheDocument());
    expect(screen.getByText("35.0%")).toBeInTheDocument();
  });

  it("renders all column headers", async () => {
    render(
      <EducationTableModal open={true} onClose={() => {}} dataUrl="/data.json" title="Education" nameLabel="County" activeEducationMetric="bachPlus" />
    );
    await waitFor(() => expect(screen.getByText("San Francisco")).toBeInTheDocument());
    expect(screen.getByText(/Bachelor's\+/, { selector: "th" })).toBeInTheDocument();
    expect(screen.getByText(/HS\+/, { selector: "th" })).toBeInTheDocument();
    expect(screen.getByText(/Graduate\+/, { selector: "th" })).toBeInTheDocument();
  });
});
