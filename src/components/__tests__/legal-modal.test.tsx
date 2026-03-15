import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LegalModal from "@/components/legal-modal";

describe("LegalModal", () => {
  it("calls showModal when opened", () => {
    render(
      <LegalModal open={true} onClose={() => {}} title="Test">
        <p>Content</p>
      </LegalModal>
    );
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
  });

  it("renders title and children", () => {
    render(
      <LegalModal open={true} onClose={() => {}} title="My Title">
        <p>My content</p>
      </LegalModal>
    );
    expect(screen.getByText("My Title")).toBeInTheDocument();
    expect(screen.getByText("My content")).toBeInTheDocument();
  });

  it("close button triggers onClose", async () => {
    const onClose = vi.fn();
    render(
      <LegalModal open={true} onClose={onClose} title="T">
        <p>C</p>
      </LegalModal>
    );
    await userEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("does not call showModal when closed", () => {
    (HTMLDialogElement.prototype.showModal as ReturnType<typeof vi.fn>).mockClear();
    render(
      <LegalModal open={false} onClose={() => {}} title="T">
        <p>C</p>
      </LegalModal>
    );
    expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled();
  });

  it("calls close when open prop changes to false", () => {
    HTMLDialogElement.prototype.close = vi.fn();
    
    // We need to simulate the dialog being in the open state
    // so that when open={false} is passed, it triggers el.close()
    const { rerender, container } = render(
      <LegalModal open={true} onClose={() => {}} title="T">
        <p>C</p>
      </LegalModal>
    );
    
    const dialog = container.querySelector('dialog');
    if (dialog) Object.defineProperty(dialog, 'open', { value: true, configurable: true });

    rerender(
      <LegalModal open={false} onClose={() => {}} title="T">
        <p>C</p>
      </LegalModal>
    );

    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
  });

  it("calls onClose when clicking the backdrop directly", async () => {
    const onClose = vi.fn();
    const { container } = render(
      <LegalModal open={true} onClose={onClose} title="T">
        <p>C</p>
      </LegalModal>
    );
    
    // Simulate clicking the dialog element itself (the backdrop)
    const dialog = container.querySelector('dialog');
    await userEvent.click(dialog!);
    
    expect(onClose).toHaveBeenCalled();
  });

  it("renders with wide styling", () => {
    const { container } = render(
      <LegalModal open={true} onClose={() => {}} title="Test Title" wide>
        Content
      </LegalModal>
    );
    
    const dialog = container.querySelector('dialog');
    expect(dialog).toHaveClass("max-w-4xl");
  });
});
