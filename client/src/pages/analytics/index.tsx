import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useCampaignStore } from "@/lib/campaignStore";

export default function Analytics() {
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    to: new Date()
  });

  // Используем глобальный стор для выбранной кампании
  const { selectedCampaign } = useCampaignStore();
  const campaignId = selectedCampaign?.id || "";

  // Получаем список всех кампаний
  const { data: campaignsResponse } = useQuery({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      try {
        const response = await fetch('/api/campaigns');
        if (!response.ok) {
          throw new Error('Не удалось загрузить кампании');
        }
        return await response.json();
      } catch (error) {
        console.error("Error loading campaigns:", error);
        throw error;
      }
    }
  });
  
  // Получаем список кампаний из ответа API
  const campaigns = campaignsResponse?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Analytics Dashboard</h1>

        <div className="flex gap-4">
          {/* Используем глобальный селектор кампаний в навигационной панели */}
          <DateRangePicker
            from={dateRange.from}
            to={dateRange.to}
            onSelect={(range) => {
              if (range?.from && range?.to) {
                setDateRange({ from: range.from, to: range.to });
              }
            }}
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Keywords</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">0</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{campaigns?.length || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generated Contents</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">0</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}