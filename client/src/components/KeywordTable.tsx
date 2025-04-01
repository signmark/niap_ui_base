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
  searchResults: any[];
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
  console.log("KeywordTable props:", { keywords, searchResults });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Результаты поиска */}
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {searchResults.map((keyword, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Checkbox
                      checked={keyword.selected}
                      onCheckedChange={() => onKeywordToggle?.(index)}
                    />
                  </TableCell>
                  <TableCell>{keyword.keyword}</TableCell>
                  <TableCell>{keyword.trend}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Добавленные ключевые слова */}
      {keywords.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Добавленные ключевые слова</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ключевое слово</TableHead>
                <TableHead>Тренд</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keywords.map((keyword) => (
                <TableRow key={keyword.id}>
                  <TableCell>{keyword.keyword}</TableCell>
                  <TableCell>{keyword.trend_score}</TableCell>
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

      {keywords.length === 0 && searchResults.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Нет ключевых слов
        </div>
      )}
    </div>
  );
}