import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { KeywordTable } from "@/components/KeywordTable";
import { useToast } from "@/hooks/use-toast";
import { Search } from "lucide-react";
import type { Keyword } from "@shared/schema";

export default function Keywords() {
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const { data: keywords, isLoading } = useQuery<Keyword[]>({
    queryKey: ["/api/keywords"],
  });

  const { mutate: searchKeywords, isPending: isSearching } = useMutation({
    mutationFn: async (keyword: string) => {
      const res = await fetch(`/api/wordstat/${encodeURIComponent(keyword)}`);
      if (!res.ok) throw new Error("Failed to search keywords");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: "Keywords found" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to search keywords",
        variant: "destructive",
      });
    },
  });

  return (
    <Layout>
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex gap-4">
              <Input
                placeholder="Enter keyword to search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Button onClick={() => searchKeywords(searchTerm)} disabled={isSearching}>
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
            </div>
          </CardContent>
        </Card>

        <KeywordTable keywords={keywords || []} isLoading={isLoading} />
      </div>
    </Layout>
  );
}
