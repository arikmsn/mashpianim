import Link from "next/link";
import { pillCreator, pillPrimary } from "./styles";

// The sticky bar at the bottom of small screens: the two identity buttons, businesses first (RTL: on the right)
export function StickyCta({ brandLabel, brandHref, creatorLabel, creatorHref }: { brandLabel: string; brandHref: string; creatorLabel: string; creatorHref: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2.5 border-t border-border bg-white/90 px-4 py-3 backdrop-blur-md md:hidden pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <Link href={brandHref} className={`${pillPrimary} flex-1`}>
        {brandLabel}
      </Link>
      <Link href={creatorHref} className={`${pillCreator} flex-1`}>
        {creatorLabel}
      </Link>
    </div>
  );
}
