import { LuHeart } from "react-icons/lu";

interface HeartButtonProps {
  favorited: boolean;
  onToggle: () => void;
}

export default function HeartButton({ favorited, onToggle }: HeartButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="text-black hover:text-red-500 transition-colors"
      title={favorited ? "Remove from favorites" : "Add to favorites"}
    >
      <LuHeart
        className={`h-4 w-4 ${favorited ? "fill-red-500 text-red-500" : ""}`}
      />
    </button>
  );
}
