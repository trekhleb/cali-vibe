import HeartButton from "@/components/heart-button";
import DetailLinkButton from "@/components/detail-link-button";

interface PlacePopupHeaderProps {
  placeType: "county" | "city";
  name: string;
  favorited: boolean;
  onToggleFavorite?: (name: string) => void;
  onViewDetail?: (name: string) => void;
}

export default function PlacePopupHeader({
  placeType,
  name,
  favorited,
  onToggleFavorite,
  onViewDetail,
}: PlacePopupHeaderProps) {
  const displayName = placeType === "county" ? `${name} County` : name;

  return (
    <div className="flex items-center gap-2">
      <div className="text-sm font-semibold text-gray-800">
        {displayName}
      </div>
      {onToggleFavorite && (
        <HeartButton favorited={favorited} onToggle={() => onToggleFavorite(name)} />
      )}
      {onViewDetail && (
        <DetailLinkButton onClick={() => onViewDetail(name)} />
      )}
    </div>
  );
}
