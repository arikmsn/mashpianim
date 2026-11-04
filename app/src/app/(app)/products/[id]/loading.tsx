// Shown the instant a product page is opened (the route shell is prefetched from the feed), until the page paints
export default function ProductLoading() {
  return (
    <main className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-neutral-100">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-neutral-100 animate-pulse" />
          <div className="h-5 bg-neutral-100 rounded-lg w-40 animate-pulse" />
        </div>
      </header>
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        <div className="h-56 bg-gradient-to-br from-pink-100 to-pink-50 rounded-2xl animate-pulse" />
        <div className="h-5 bg-neutral-100 rounded-lg w-2/3 animate-pulse" />
        <div className="h-24 bg-white rounded-2xl border border-neutral-100 animate-pulse" />
        <div className="h-32 bg-white rounded-2xl border border-neutral-100 animate-pulse" />
      </div>
    </main>
  );
}
