export function AccountIcon({ initials, color }: { initials: string; color: "blue" | "rose" }) {
  return (
    <div 
      className={`flex h-7 w-7 items-center justify-center rounded-full bg-${color}-600 text-white`}
    >
      {initials}
    </div>
  )
} 