import { render, screen } from "@testing-library/react";
import SortableFavoriteList from "@/components/favorites/sortable-favorite-list";

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children, onDragEnd }: any) => (
    <div 
      data-testid="dnd-context" 
      onClick={(e) => {
        // We'll pass the mocked event payload in a custom attribute for testing
        const customEvent = (e.target as any).__customEvent;
        if (customEvent) onDragEnd(customEvent);
      }}>
      {children}
    </div>
  ),
  closestCenter: vi.fn(),
  useSensor: vi.fn(),
  useSensors: () => [],
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  TouchSensor: vi.fn(),
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: any) => <div>{children}</div>,
  verticalListSortingStrategy: {},
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  arrayMove: vi.fn().mockImplementation((arr, oldIdx, newIdx) => {
    const res = [...arr];
    const [item] = res.splice(oldIdx, 1);
    res.splice(newIdx, 0, item);
    return res;
  }),
}));

vi.mock("@dnd-kit/modifiers", () => ({
  restrictToVerticalAxis: vi.fn(),
  restrictToParentElement: vi.fn(),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => null } },
}));

describe("SortableFavoriteList", () => {
  it("renders all items", () => {
    render(
      <SortableFavoriteList
        items={["A", "B", "C"]}
        onReorder={() => {}}
        onClickItem={() => {}}
        onRemoveItem={() => {}}
      />
    );
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
  });

  it("renders nothing for empty list", () => {
    const { container } = render(
      <SortableFavoriteList
        items={[]}
        onReorder={() => {}}
        onClickItem={() => {}}
        onRemoveItem={() => {}}
      />
    );
    expect(container.querySelectorAll("li")).toHaveLength(0);
  });

  it("handles drag end and calls onReorder", () => {
    const onReorder = vi.fn();
    render(
      <SortableFavoriteList
        items={["A", "B", "C"]}
        onReorder={onReorder}
        onClickItem={() => {}}
        onRemoveItem={() => {}}
      />
    );

    const dndContext = screen.getByTestId("dnd-context");
    
    // Simulate active id 'A' over 'C'
    (dndContext as any).__customEvent = {
      active: { id: "A" },
      over: { id: "C" },
    };
    dndContext.click();
    
    expect(onReorder).toHaveBeenCalledWith(["B", "C", "A"]);
  });

  it("ignores drag end if over is null or same id", () => {
    const onReorder = vi.fn();
    render(
      <SortableFavoriteList
        items={["A", "B", "C"]}
        onReorder={onReorder}
        onClickItem={() => {}}
        onRemoveItem={() => {}}
      />
    );

    const dndContext = screen.getByTestId("dnd-context");
    
    // Over is null
    (dndContext as any).__customEvent = {
      active: { id: "A" },
      over: null,
    };
    dndContext.click();
    
    // Same id
    (dndContext as any).__customEvent = {
      active: { id: "A" },
      over: { id: "A" },
    };
    dndContext.click();
    
    expect(onReorder).not.toHaveBeenCalled();
  });
});
