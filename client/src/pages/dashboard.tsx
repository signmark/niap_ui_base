import { useQuery } from "@tanstack/react-query";
import StatsCards from "@/components/dashboard/stats-cards";
import ContentCalendar from "@/components/dashboard/content-calendar";
import AIGenerator from "@/components/dashboard/ai-generator";
import TrendingTopics from "@/components/dashboard/trending-topics";
import AnalyticsChart from "@/components/dashboard/analytics-chart";
import CampaignList from "@/components/campaigns/campaign-list";
import ContentForm from "@/components/content/content-form";
import { campaignsApi, contentApi, analyticsApi } from "@/lib/api";

export default function Dashboard() {
  const { data: campaigns = [] } = useQuery({
    queryKey: ["/api/campaigns"],
    queryFn: campaignsApi.getAll,
  });

  const { data: scheduledContent = [] } = useQuery({
    queryKey: ["/api/content/scheduled"],
    queryFn: contentApi.getScheduled,
  });

  const { data: analyticsSummary } = useQuery({
    queryKey: ["/api/analytics/summary"],
    queryFn: analyticsApi.getSummary,
  });

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <StatsCards analyticsSummary={analyticsSummary} campaignsCount={campaigns.length} />
      
      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Content Calendar */}
        <div className="lg:col-span-2">
          <ContentCalendar scheduledContent={scheduledContent} />
        </div>
        
        {/* Right Sidebar */}
        <div className="space-y-6">
          <AIGenerator />
          <TrendingTopics />
        </div>
      </div>
      
      {/* Analytics Chart */}
      <AnalyticsChart />
      
      {/* Campaign Management Section */}
      <CampaignList campaigns={campaigns} />
      
      {/* Content Creation Interface */}
      <ContentForm />
    </div>
  );
}
