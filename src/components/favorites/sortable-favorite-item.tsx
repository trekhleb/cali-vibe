import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LuGripVertical, LuX } from "react-icons/lu";

interface SortableFavoriteItemProps {
  id: string;
  onClickItem: (name: string) => void;
  onRemoveItem: (name: string) => void;
}

export default function SortableFavoriteItem({
  id,
  onClickItem,
  onRemoveItem,
}: SortableFavoriteItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1 rounded-md px-2 py-1 text-sm text-gray-700 ${
        isDragging ? "bg-white shadow-md" : "hover:bg-gray-50"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 cursor-grab touch-none text-gray-300 hover:text-gray-500 active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <LuGripVertical className="h-3 w-3" />
      </button>

      <button
        onClick={() => onClickItem(id)}
        className="flex-1 text-left hover:text-black transition-colors cursor-pointer truncate"
      >
        {id}
      </button>

      <button
        onClick={() => onRemoveItem(id)}
        className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors"
        title="Remove from favorites"
      >
        <LuX className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}
