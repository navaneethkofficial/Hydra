import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function HistoryLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 35 }, (_, index) => (
                <Skeleton key={index} className="aspect-square rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-12 w-full rounded-xl" />
          </CardContent>
        </Card>
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    </div>
  );
}
