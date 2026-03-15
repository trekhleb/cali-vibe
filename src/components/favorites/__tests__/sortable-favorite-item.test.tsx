import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SortableFavoriteItem from "@/components/favorites/sortable-favorite-item";

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => null } },
}));

describe("SortableFavoriteItem", () => {
  it("renders item name", () => {
    render(
      <ul>
        <SortableFavoriteItem id="Los Angeles" onClickItem={() => {}} onRemoveItem={() => {}} />
      </ul>
    );
    expect(screen.getByText("Los Angeles")).toBeInTheDocument();
  });

  it("clicking name calls onClickItem", async () => {
    const onClickItem = vi.fn();
    render(
      <ul>
        <SortableFavoriteItem id="LA" onClickItem={onClickItem} onRemoveItem={() => {}} />
      </ul>
    );
    await userEvent.click(screen.getByText("LA"));
    expect(onClickItem).toHaveBeenCalledWith("LA");
  });

  it("clicking X calls onRemoveItem", async () => {
    const onRemoveItem = vi.fn();
    render(
      <ul>
        <SortableFavoriteItem id="LA" onClickItem={() => {}} onRemoveItem={onRemoveItem} />
      </ul>
    );
    await userEvent.click(screen.getByTitle("Remove from favorites"));
    expect(onRemoveItem).toHaveBeenCalledWith("LA");
  });
});
