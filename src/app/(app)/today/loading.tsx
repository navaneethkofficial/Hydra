import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the dashboard's shape so nothing shifts when the data arrives. */
export default function TodayLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-32" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-6">
          <Card className="flex flex-col items-center gap-6 p-8">
            <Skeleton className="size-[264px] rounded-full" />
            <div className="w-full max-w-sm space-y-2.5">
              <Skeleton className="h-14 w-full rounded-full" />
              <div className="grid grid-cols-4 gap-2.5">
                {Array.from({ length: 4 }, (_, index) => (
                  <Skeleton key={index} className="h-12 rounded-full" />
                ))}
              </div>
            </div>
          </Card>
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>

        <div className="space-y-6">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
