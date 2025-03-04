import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Trash2 } from "lucide-react";

interface KeywordTableProps {
  keywords: any[];
  searchResults?: any[];
  isLoading: boolean;
  onDelete: (id: string) => void;
  onKeywordToggle?: (index: number) => void;
  onSelectAll?: (checked: boolean) => void;
  onSaveSelected?: () => void;
}

export function KeywordTable({
  keywords = [],
  searchResults = [],
  isLoading,
  onDelete,
  onKeywordToggle,
  onSelectAll,
  onSaveSelected
}: KeywordTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const formatKeyword = (keyword: any) => ({
    id: keyword.id,
    keyword: keyword.keyword,
    trend: keyword.trend_score || keyword.trend || 0,
    competition: keyword.mentions_count || keyword.competition || 0
  });

  return (
    <div className="space-y-8">
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
              {keywords.map((keyword) => {
                const formattedKeyword = formatKeyword(keyword);
                return (
                  <TableRow key={formattedKeyword.id}>
                    <TableCell>{formattedKeyword.keyword}</TableCell>
                    <TableCell>{formattedKeyword.trend}</TableCell>
                    <TableCell>{formattedKeyword.competition}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(formattedKeyword.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {searchResults.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Результаты поиска</h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={searchResults.every(kw => kw.selected)}
                  onCheckedChange={(checked) => onSelectAll?.(!!checked)}
                />
                <label htmlFor="select-all" className="text-sm">
                  Выбрать все
                </label>
              </div>
              <Button
                onClick={onSaveSelected}
                disabled={!searchResults.some(kw => kw.selected)}
              >
                Добавить выбранные ({searchResults.filter(kw => kw.selected).length})
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Ключевое слово</TableHead>
                <TableHead>Тренд</TableHead>
                <TableHead>Конкуренция</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searchResults.map((keyword, index) => {
                const formattedKeyword = formatKeyword(keyword);
                return (
                  <TableRow key={index}>
                    <TableCell>
                      <Checkbox
                        checked={keyword.selected}
                        onCheckedChange={() => onKeywordToggle?.(index)}
                      />
                    </TableCell>
                    <TableCell>{formattedKeyword.keyword}</TableCell>
                    <TableCell>{formattedKeyword.trend}</TableCell>
                    <TableCell>{formattedKeyword.competition}</TableCell>
                  </TableRow>
                );
              })}
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