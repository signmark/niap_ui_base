import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Trash2 } from "lucide-react";

interface Keyword {
  id: string;
  keyword: string;
  trend_score?: number;
  trend?: number;
  mentions_count?: number;
  selected?: boolean;
}

interface KeywordTableProps {
  keywords: Keyword[];
  searchResults?: Keyword[];
  isLoading: boolean;
  onDelete: (id: string) => void;
  onAdd?: (keyword: Keyword) => void;
}

export function KeywordTable({
  keywords = [],
  searchResults = [],
  isLoading,
  onDelete,
  onAdd
}: KeywordTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Существующие ключевые слова */}
      {keywords.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Добавленные ключевые слова</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ключевое слово</TableHead>
                <TableHead>Тренд</TableHead>
                <TableHead>Конкуренция</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keywords.map((keyword) => (
                <TableRow key={keyword.id}>
                  <TableCell>{keyword.keyword}</TableCell>
                  <TableCell>{keyword.trend_score || 0}</TableCell>
                  <TableCell>{keyword.mentions_count || 0}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(keyword.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Результаты поиска */}
      {searchResults.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Результаты поиска</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ключевое слово</TableHead>
                <TableHead>Тренд</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searchResults.map((keyword, index) => (
                <TableRow key={index}>
                  <TableCell>{keyword.keyword}</TableCell>
                  <TableCell>{keyword.trend || 0}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onAdd?.(keyword)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {keywords.length === 0 && searchResults.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Нет ключевых слов
        </div>
      )}
    </div>
  );
}