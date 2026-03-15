import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HeartButton from "@/components/heart-button";

describe("HeartButton", () => {
  it("renders button with correct title when not favorited", () => {
    render(<HeartButton favorited={false} onToggle={() => {}} />);
    expect(screen.getByTitle("Add to favorites")).toBeInTheDocument();
  });

  it("renders button with correct title when favorited", () => {
    render(<HeartButton favorited={true} onToggle={() => {}} />);
    expect(screen.getByTitle("Remove from favorites")).toBeInTheDocument();
  });

  it("calls onToggle on click", async () => {
    const onToggle = vi.fn();
    render(<HeartButton favorited={false} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("stops event propagation", async () => {
    const parentClick = vi.fn();
    const onToggle = vi.fn();
    render(
      <div onClick={parentClick}>
        <HeartButton favorited={false} onToggle={onToggle} />
      </div>
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalled();
    expect(parentClick).not.toHaveBeenCalled();
  });
});
