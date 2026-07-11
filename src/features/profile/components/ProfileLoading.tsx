import { Skeleton } from "@/components/ui/skeleton";

export function ProfileLoading() {
  return (
    <section className="mx-auto max-w-6xl" aria-label="Loading profile">
      <div className="grid min-w-0 gap-10 xl:grid-cols-[16rem_minmax(0,1fr)] xl:items-start xl:gap-12">
        <aside className="space-y-6">
          <div className="space-y-3">
            <div
              data-slot="profile-identity-loading"
              className="inline-flex max-w-full flex-col items-center gap-6 align-top"
            >
              <Skeleton className="size-20 xl:size-28" />
              <div className="flex min-w-0 max-w-full items-center">
                <Skeleton className="h-7 w-44 max-w-full" />
              </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-3 w-12 max-w-full" />
              </div>
            ))}
          </div>
          <Skeleton className="h-px w-full" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-16" />
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        </aside>

        <div className="min-w-0 space-y-10">
          <section className="space-y-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-32 w-full" />
          </section>
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-7 w-24" />
            </div>
            <div className="space-y-4 rounded-md border border-border/70 p-4">
              <Skeleton className="h-8 w-36" />
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
