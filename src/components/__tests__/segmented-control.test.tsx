import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SegmentedControl from "@/components/segmented-control";

const options = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Charlie" },
];

describe("SegmentedControl", () => {
  it("renders all options", () => {
    render(<SegmentedControl value="a" onChange={() => {}} options={options} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });

  it("active option has distinct styling", () => {
    render(<SegmentedControl value="b" onChange={() => {}} options={options} />);
    const activeBtn = screen.getByText("Beta");
    expect(activeBtn.className).toContain("bg-black");
  });

  it("clicking option triggers onChange", async () => {
    const onChange = vi.fn();
    render(<SegmentedControl value="a" onChange={onChange} options={options} />);
    await userEvent.click(screen.getByText("Charlie"));
    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("renders icons when provided", () => {
    const opts = [{ value: "x", label: "X", icon: <span data-testid="icon">★</span> }];
    render(<SegmentedControl value="x" onChange={() => {}} options={opts} />);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });
});
