export default function FeedLoading() {
  return (
    <main id="main-content" className="mx-auto min-h-screen w-full max-w-5xl px-4 py-16 md:px-8" aria-busy="true">
      <div className="h-64 animate-pulse rounded-3xl bg-[var(--pa-color-accent-fill-06)]" />
      <div className="mt-8 grid gap-5">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-56 animate-pulse rounded-3xl bg-[var(--pa-color-accent-fill-04)]" />
        ))}
      </div>
      <span className="sr-only">正在加载收藏动态 / Loading Favorite Activity</span>
    </main>
  );
}
