import { useState } from "react";
import { Layout } from "@/components/Layout";
import { PostCalendar } from "@/components/PostCalendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { directusApi } from "@/lib/directus";

export default function Posts() {
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");

  // Получаем список кампаний
  const { data: campaigns } = useQuery({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      const response = await directusApi.get("/items/user_campaigns");
      return response.data?.data || [];
    }
  });

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold">Календарь публикаций</h1>
          <p className="text-muted-foreground mt-2">
            Управляйте публикациями для выбранной кампании
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <Select 
              value={selectedCampaign} 
              onValueChange={setSelectedCampaign}
            >
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Выберите кампанию" />
              </SelectTrigger>
              <SelectContent>
                {campaigns?.map((campaign: any) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedCampaign && (
          <PostCalendar campaignId={selectedCampaign} />
        )}
      </div>
    </Layout>
  );
}