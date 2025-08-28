import { Card, CardContent } from "@/components/ui/card";
import { Megaphone, Share, Eye, Heart } from "lucide-react";

interface StatsCardsProps {
  analyticsSummary?: {
    totalImpressions: number;
    totalClicks: number;
    totalShares: number;
    totalComments: number;
    avgEngagement: number;
  };
  campaignsCount: number;
}

export default function StatsCards({ analyticsSummary, campaignsCount }: StatsCardsProps) {
  const stats = [
    {
      title: "Активные кампании",
      value: campaignsCount.toString(),
      change: "+8%",
      icon: Megaphone,
      bgColor: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      title: "Опубликовано постов",
      value: "1,847",
      change: "+15%",
      icon: Share,
      bgColor: "bg-secondary/10",
      iconColor: "text-secondary",
    },
    {
      title: "Общий охват",
      value: analyticsSummary?.totalImpressions 
        ? (analyticsSummary.totalImpressions / 1000).toFixed(1) + "K" 
        : "89.2K",
      change: "+23%",
      icon: Eye,
      bgColor: "bg-accent/10",
      iconColor: "text-accent",
    },
    {
      title: "Вовлеченность",
      value: analyticsSummary?.avgEngagement 
        ? analyticsSummary.avgEngagement.toFixed(1) + "%" 
        : "12.8%",
      change: "+5%",
      icon: Heart,
      bgColor: "bg-yellow-100",
      iconColor: "text-yellow-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="hover:shadow-md transition-shadow" data-testid={`stat-card-${index}`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">{stat.title}</p>
                  <p className="text-2xl font-bold text-foreground" data-testid={`stat-value-${index}`}>
                    {stat.value}
                  </p>
                </div>
                <div className={`w-12 h-12 ${stat.bgColor} rounded-lg flex items-center justify-center`}>
                  <Icon className={`${stat.iconColor} text-lg h-5 w-5`} />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                <span className="text-accent text-sm font-medium">{stat.change}</span>
                <span className="text-muted-foreground text-sm ml-1">от прошлого месяца</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
