import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CaliVibeLogo from "@/components/cali-vibe-logo";

describe("CaliVibeLogo", () => {
  it("renders img with default size", () => {
    render(<CaliVibeLogo />);
    const img = screen.getByRole("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("width", "28");
    expect(img).toHaveAttribute("height", "28");
  });

  it("renders img with custom size", () => {
    render(<CaliVibeLogo size={54} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("width", "54");
  });

  it("without onClick renders no button", () => {
    render(<CaliVibeLogo />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("with onClick wraps img in button", async () => {
    const onClick = vi.fn();
    render(<CaliVibeLogo onClick={onClick} />);
    const btn = screen.getByRole("button");
    expect(btn).toBeInTheDocument();
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
