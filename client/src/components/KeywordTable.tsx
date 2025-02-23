import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { Keyword } from "@shared/schema";

interface KeywordTableProps {
  keywords: Keyword[];
  isLoading: boolean;
}

export function KeywordTable({ keywords, isLoading }: KeywordTableProps) {
  const { toast } = useToast();

  if (isLoading) {
    return <div>Loading keywords...</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Keyword</TableHead>
          <TableHead>Trend</TableHead>
          <TableHead>Competition</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {keywords.map((keyword) => (
          <TableRow key={keyword.id}>
            <TableCell>{keyword.word}</TableCell>
            <TableCell>{keyword.trend}</TableCell>
            <TableCell>{keyword.competition}</TableCell>
            <TableCell>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  toast({
                    title: "Success",
                    description: "Keyword added to campaign",
                  })
                }
              >
                Add to Campaign
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
