import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Toggle from "@/components/toggle";

describe("Toggle", () => {
  it("renders a checkbox input", () => {
    render(<Toggle checked={false} onChange={() => {}} />);
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("reflects checked state", () => {
    render(<Toggle checked={true} onChange={() => {}} />);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("calls onChange when clicked", async () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} />);
    await userEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("renders md size by default", () => {
    const { container } = render(<Toggle checked={false} onChange={() => {}} />);
    expect(container.querySelector(".h-6.w-11")).toBeInTheDocument();
  });

  it("renders sm size variant", () => {
    const { container } = render(<Toggle checked={false} onChange={() => {}} size="sm" />);
    expect(container.querySelector(".h-5.w-9")).toBeInTheDocument();
  });
});
