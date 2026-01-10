import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export default function DashboardPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dashboard</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-zinc-600">
          Message history, filters, and delivery status will appear here.
        </p>
      </CardContent>
    </Card>
  );
}
