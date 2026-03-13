interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: "sm" | "md";
}

export default function Toggle({ checked, onChange, size = "md" }: ToggleProps) {
  return (
    <div className="relative">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      {size === "md" ? (
        <>
          <div className="h-6 w-11 rounded-full bg-gray-300 peer-checked:bg-black transition-colors" />
          <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
        </>
      ) : (
        <>
          <div className="h-5 w-9 rounded-full bg-gray-300 peer-checked:bg-black transition-colors" />
          <div className="absolute left-[2px] top-[2px] h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
        </>
      )}
    </div>
  );
}
