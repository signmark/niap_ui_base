import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Chart } from "@/components/ui/chart";
import { format } from "date-fns";
import type { Campaign } from "@shared/schema";

export default function Analytics() {
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    to: new Date()
  });

  const { data: campaigns } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  // Mock data for demonstration
  const trendData = {
    options: {
      chart: {
        id: "trend-chart",
        type: "line" as const,
        toolbar: {
          show: false
        }
      },
      stroke: {
        curve: "smooth" as const
      },
      xaxis: {
        categories: Array.from({ length: 30 }, (_, i) => 
          format(new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000), "MMM dd")
        )
      }
    },
    series: [{
      name: "Search Volume",
      data: Array.from({ length: 30 }, () => Math.floor(Math.random() * 1000))
    }]
  };

  const demographicsData = {
    options: {
      chart: {
        id: "demographics-chart",
        type: "bar" as const,
        toolbar: {
          show: false
        }
      },
      plotOptions: {
        bar: {
          horizontal: true
        }
      },
      xaxis: {
        categories: ["18-24", "25-34", "35-44", "45-54", "55+"]
      }
    },
    series: [{
      name: "Users",
      data: [15, 30, 25, 18, 12]
    }]
  };

  const keywordPerformanceData = {
    options: {
      chart: {
        id: "keyword-chart",
        type: "pie" as const,
        toolbar: {
          show: false
        }
      },
      labels: ["SEO", "Digital Marketing", "Content Strategy", "Analytics", "Social Media"]
    },
    series: [25, 20, 18, 15, 22]
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>

          <div className="flex gap-4">
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select Campaign" />
              </SelectTrigger>
              <SelectContent>
                {campaigns?.map(campaign => (
                  <SelectItem key={campaign.id} value={campaign.id.toString()}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Search Volume Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <Chart
                type="line"
                options={trendData.options}
                series={trendData.series}
                height={300}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Demographics</CardTitle>
            </CardHeader>
            <CardContent>
              <Chart
                type="bar"
                options={demographicsData.options}
                series={demographicsData.series}
                height={300}
              />
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Top Keywords Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <Chart
                type="pie"
                options={keywordPerformanceData.options}
                series={keywordPerformanceData.series}
                height={300}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}