import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MapFooter from "@/components/map-footer";

describe("MapFooter", () => {
  it("renders illustration text and action buttons", () => {
    render(<MapFooter />);
    expect(screen.getByText("For illustration only.")).toBeInTheDocument();
    expect(screen.getAllByText("Disclaimer").length).toBeGreaterThanOrEqual(1);
  });

  it("clicking Disclaimer opens disclaimer modal and closes", async () => {
    render(<MapFooter />);
    const buttons = screen.getAllByText("Disclaimer");
    await userEvent.click(buttons[0]);
    expect(screen.getByText(/non-commercial project/)).toBeInTheDocument();
    
    // Close modal
    const closeButtons = screen.getAllByRole("button", { name: "Close" });
    await userEvent.click(closeButtons[0]);
  });

  it("clicking Sources opens sources modal and closes", async () => {
    render(<MapFooter />);
    const buttons = screen.getAllByText("Sources");
    await userEvent.click(buttons[0]);
    expect(screen.getByText("Data Sources")).toBeInTheDocument();
    
    const closeButtons = screen.getAllByRole("button", { name: "Close" });
    await userEvent.click(closeButtons[0]);
  });

  it("clicking Privacy opens privacy modal and closes", async () => {
    render(<MapFooter />);
    const buttons = screen.getAllByText("Privacy");
    await userEvent.click(buttons[0]);
    expect(screen.getByRole("heading", { name: "Privacy Policy" })).toBeInTheDocument();
    
    const closeButtons = screen.getAllByRole("button", { name: "Close" });
    await userEvent.click(closeButtons[0]);
  });
});
