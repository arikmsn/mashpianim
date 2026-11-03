import Link from "next/link";
import Image from "next/image";

// Hebrew, right-to-left 404 (Next's default is English and left-to-right)
export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6" dir="rtl">
      <div className="text-center max-w-sm">
        <Image src="/icon-192.png" alt="משפיען אונליין" width={72} height={72} unoptimized className="mx-auto rounded-2xl shadow-lg shadow-ig-pink/20 mb-5" />
        <p className="text-sm font-medium text-pink-500 mb-1">404</p>
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">הדף לא נמצא</h1>
        <p className="text-sm text-neutral-500 mb-6">הקישור שגוי או שהדף הוסר. אפשר לחזור למסך הבית ולהמשיך משם.</p>
        <div className="flex flex-col gap-2">
          <Link href="/feed" className="w-full px-6 py-3 rounded-xl ig-gradient-bg text-white font-medium hover:opacity-90 transition-opacity">
            למסך הבית
          </Link>
          <Link href="/" className="w-full px-6 py-3 rounded-xl bg-white border border-neutral-200 text-neutral-700 font-medium hover:bg-neutral-50 transition-colors">
            לדף הפתיחה
          </Link>
        </div>
      </div>
    </main>
  );
}
