interface CaliVibeLogoProps {
  size?: number;
  onClick?: () => void;
}

export default function CaliVibeLogo({ size = 28, onClick }: CaliVibeLogoProps) {
  const img = (
    <img
      src={`${import.meta.env.BASE_URL}bear.svg`}
      alt="CaliVibe logo"
      width={size}
      height={size}
      style={{ display: "block", transform: "scaleX(-1)" }}
    />
  );

  if (!onClick) return img;

  return (
    <button
      onClick={onClick}
      className="cursor-pointer hover:opacity-70 transition-opacity"
      title="Reset to defaults"
    >
      {img}
    </button>
  );
}
