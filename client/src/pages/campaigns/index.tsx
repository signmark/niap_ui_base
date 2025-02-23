import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { CampaignForm } from "@/components/CampaignForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/lib/store";
import type { Campaign } from "@shared/schema";

export default function Campaigns() {
  const [isOpen, setIsOpen] = useState(false);
  const userId = useAuthStore((state) => state.userId);

  const { data: campaigns, isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
    enabled: !!userId,
  });

  const { mutate: deleteCampaign } = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <Button onClick={() => setIsOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Campaign
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {campaigns?.map((campaign) => (
          <Card key={campaign.id}>
            <CardHeader>
              <CardTitle>{campaign.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">{campaign.description}</p>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteCampaign(campaign.id)}
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <CampaignForm onClose={() => setIsOpen(false)} />
      </Dialog>
    </Layout>
  );
}
