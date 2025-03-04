import { useState } from "react";
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { directusApi } from "@/lib/directus";

interface NewSourcesDialogProps {
  campaignId: string;
  onClose: () => void;
  sourcesData: {
    success?: boolean;
    data?: {
      sources: Array<{
        url: string;
        name: string;
        followers: number;
        platform: string;
        description: string;
        rank: number;
      }>;
    };
  };
}

export function NewSourcesDialog({ campaignId, onClose, sourcesData }: NewSourcesDialogProps) {
  console.log('Dialog received sourcesData:', sourcesData);
  const sources = sourcesData?.data?.sources || [];
  console.log('Available sources:', sources);

  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const { add: toast } = useToast();

  const handleAddSources = async () => {
    if (selectedSources.length === 0) {
      toast({
        description: "Выберите хотя бы один источник",
        variant: "destructive"
      });
      return;
    }

    setIsAdding(true);

    try {
      const sourcesToAdd = sources.filter(source => 
        selectedSources.includes(source.url)
      );

      for (const source of sourcesToAdd) {
        await directusApi.post('/items/campaign_content_sources', {
          name: source.name,
          url: source.url,
          type: source.platform,
          campaign_id: campaignId,
          is_active: true
        });
      }

      toast({
        description: `Добавлено ${sourcesToAdd.length} источников`
      });
      onClose();
    } catch (error) {
      console.error('Error adding sources:', error);
      toast({
        description: "Ошибка при добавлении источников",
        variant: "destructive"
      });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Найденные источники</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        {/* Debug output */}
        <pre className="text-xs bg-gray-100 p-2 rounded">
          {JSON.stringify({
            success: sourcesData?.success,
            hasData: !!sourcesData?.data,
            sourcesLength: sources?.length,
            firstSource: sources[0]
          }, null, 2)}
        </pre>

        {/* Content */}
        {!sourcesData?.data?.sources ? (
          <p className="text-center text-muted-foreground">
            Ошибка при получении источников
          </p>
        ) : sources.length === 0 ? (
          <p className="text-center text-muted-foreground">
            Нет подходящих источников
          </p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {sources.map((source, index) => (
              <Card key={index} className="p-4">
                <CardContent className="p-0">
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={selectedSources.includes(source.url)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedSources([...selectedSources, source.url]);
                        } else {
                          setSelectedSources(selectedSources.filter(url => url !== source.url));
                        }
                      }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium">{source.name}</h3>
                        <Badge variant="outline" className="whitespace-nowrap">
                          {source.followers >= 1000000 
                            ? `${(source.followers / 1000000).toFixed(1)}M`
                            : source.followers >= 1000 
                            ? `${(source.followers / 1000).toFixed(1)}K`
                            : source.followers} подписчиков
                        </Badge>
                      </div>

                      {source.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {source.description}
                        </p>
                      )}

                      <p className="text-sm break-all mt-2">
                        <a
                          href={source.url.startsWith('http') ? source.url : `https://${source.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline"
                        >
                          {source.url}
                        </a>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button 
            onClick={handleAddSources} 
            disabled={selectedSources.length === 0 || isAdding}
          >
            {isAdding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Добавление...
              </>
            ) : (
              `Добавить ${selectedSources.length} источников`
            )}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}