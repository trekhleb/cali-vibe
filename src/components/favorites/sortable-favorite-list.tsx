import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import SortableFavoriteItem from "./sortable-favorite-item";

interface SortableFavoriteListProps {
  items: string[];
  onReorder: (names: string[]) => void;
  onClickItem: (name: string) => void;
  onRemoveItem: (name: string) => void;
}

export default function SortableFavoriteList({
  items,
  onReorder,
  onClickItem,
  onRemoveItem,
}: SortableFavoriteListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.indexOf(active.id as string);
      const newIndex = items.indexOf(over.id as string);
      onReorder(arrayMove(items, oldIndex, newIndex));
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-0.5">
          {items.map((name) => (
            <SortableFavoriteItem
              key={name}
              id={name}
              onClickItem={onClickItem}
              onRemoveItem={onRemoveItem}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
