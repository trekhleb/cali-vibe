import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InfoTooltip from "@/components/info-tooltip";

describe("InfoTooltip", () => {
  it("renders 'i' icon", () => {
    render(<InfoTooltip>Tooltip content</InfoTooltip>);
    expect(screen.getByText("i")).toBeInTheDocument();
  });

  it("tooltip is not rendered initially", () => {
    render(<InfoTooltip>Tooltip content</InfoTooltip>);
    expect(screen.queryByText("Tooltip content")).toBeNull();
  });

  it("click shows tooltip, second click hides", async () => {
    render(<InfoTooltip>Tooltip content</InfoTooltip>);
    // Open
    await userEvent.click(screen.getByText("i"));
    expect(screen.getByText("Tooltip content")).toBeInTheDocument();

    // Close by clicking "i" again
    await userEvent.click(screen.getByText("i"));
    await userEvent.unhover(screen.getByText("i"));
    // After toggling off, tooltip should disappear since neither open nor hover
    // The component uses `visible = open || hover`; after second click open=false, hover=false
    expect(screen.queryByText("Tooltip content")).toBeNull();
  });
});
