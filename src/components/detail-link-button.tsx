import { FaArrowRight } from "react-icons/fa6";

interface DetailLinkButtonProps {
  onClick: () => void;
}

export default function DetailLinkButton({ onClick }: DetailLinkButtonProps) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="inline-flex items-center justify-center rounded-full p-0.5 text-gray-900 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
      title="View details"
      aria-label="View details"
    >
      <FaArrowRight className="h-3.5 w-3.5" />
    </button>
  );
}
