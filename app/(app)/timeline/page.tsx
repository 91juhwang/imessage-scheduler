import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TimelinePage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-zinc-600">
          Your scheduling timeline will appear here.
        </p>
      </CardContent>
    </Card>
  );
}
