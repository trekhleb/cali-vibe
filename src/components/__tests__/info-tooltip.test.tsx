import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InfoTooltip from "@/components/info-tooltip";

describe("InfoTooltip", () => {
  function getInfoIcon() {
    return screen.getByRole("generic", { hidden: false }).querySelector("svg")!.closest("span")!;
  }

  it("renders info icon", () => {
    const { container } = render(<InfoTooltip>Tooltip content</InfoTooltip>);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("tooltip is not rendered initially", () => {
    render(<InfoTooltip>Tooltip content</InfoTooltip>);
    expect(screen.queryByText("Tooltip content")).toBeNull();
  });

  it("click shows tooltip, second click hides", async () => {
    const { container } = render(<InfoTooltip>Tooltip content</InfoTooltip>);
    const icon = container.querySelector("svg")!.closest("span")!;
    // Open
    await userEvent.click(icon);
    expect(screen.getByText("Tooltip content")).toBeInTheDocument();

    // Close by clicking icon again
    await userEvent.click(icon);
    await userEvent.unhover(icon);
    expect(screen.queryByText("Tooltip content")).toBeNull();
  });
});
