import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Определение схемы валидации для формы бизнес-анкеты
const businessQuestionnaireSchema = z.object({
  companyName: z.string().min(2, {
    message: "Название компании должно содержать минимум 2 символа",
  }),
  contactInfo: z.string().min(5, {
    message: "Контактная информация должна содержать минимум 5 символов",
  }),
  businessDescription: z.string().min(10, {
    message: "Описание бизнеса должно содержать минимум 10 символов",
  }),
  mainDirections: z.string().min(5, {
    message: "Основные направления должны содержать минимум 5 символов",
  }),
  brandImage: z.string().min(5, {
    message: "Образ бренда должен содержать минимум 5 символов",
  }),
  productsServices: z.string().min(5, {
    message: "Продукты и услуги должны содержать минимум 5 символов",
  }),
  targetAudience: z.string().min(5, {
    message: "Целевая аудитория должна содержать минимум 5 символов",
  }),
  customerResults: z.string().min(5, {
    message: "Результаты клиентов должны содержать минимум 5 символов",
  }),
  companyFeatures: z.string().min(5, {
    message: "Особенности компании должны содержать минимум 5 символов",
  }),
  businessValues: z.string().min(5, {
    message: "Ценности бизнеса должны содержать минимум 5 символов",
  }),
  productBeliefs: z.string().min(5, {
    message: "Убеждения о продукте должны содержать минимум 5 символов",
  }),
  competitiveAdvantages: z.string().min(5, {
    message: "Конкурентные преимущества должны содержать минимум 5 символов",
  }),
  marketingExpectations: z.string().min(5, {
    message: "Ожидания от маркетинга должны содержать минимум 5 символов",
  }),
});

type BusinessQuestionnaireFormValues = z.infer<typeof businessQuestionnaireSchema>;

interface BusinessQuestionnaireFormProps {
  campaignId: string;
  onQuestionnaireUpdated?: () => void;
}

export function BusinessQuestionnaireForm({
  campaignId,
  onQuestionnaireUpdated,
}: BusinessQuestionnaireFormProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [isWebsiteDialogOpen, setIsWebsiteDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Получение данных анкеты для текущей кампании
  const { data: questionnaireData, isLoading } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/questionnaire`],
    queryFn: () => 
      apiRequest(`/api/campaigns/${campaignId}/questionnaire`),
  });
  
  // Форма с валидацией
  const form = useForm<BusinessQuestionnaireFormValues>({
    resolver: zodResolver(businessQuestionnaireSchema),
    defaultValues: {
      companyName: "",
      contactInfo: "",
      businessDescription: "",
      mainDirections: "",
      brandImage: "",
      productsServices: "",
      targetAudience: "",
      customerResults: "",
      companyFeatures: "",
      businessValues: "",
      productBeliefs: "",
      competitiveAdvantages: "",
      marketingExpectations: "",
    },
  });

  // Заполнение формы данными из API, когда они загружены
  useEffect(() => {
    if (questionnaireData?.data) {
      const questionnaire = questionnaireData.data;
      form.reset({
        companyName: questionnaire.companyName || "",
        contactInfo: questionnaire.contactInfo || "",
        businessDescription: questionnaire.businessDescription || "",
        mainDirections: questionnaire.mainDirections || "",
        brandImage: questionnaire.brandImage || "",
        productsServices: questionnaire.productsServices || "",
        targetAudience: questionnaire.targetAudience || "",
        customerResults: questionnaire.customerResults || "",
        companyFeatures: questionnaire.companyFeatures || "",
        businessValues: questionnaire.businessValues || "",
        productBeliefs: questionnaire.productBeliefs || "",
        competitiveAdvantages: questionnaire.competitiveAdvantages || "",
        marketingExpectations: questionnaire.marketingExpectations || "",
      });
    }
  }, [questionnaireData, form]);

  // Мутация для создания новой анкеты
  const createQuestionnaireMutation = useMutation({
    mutationFn: async (values: BusinessQuestionnaireFormValues) => {
      return apiRequest(`/api/campaigns/${campaignId}/questionnaire`, {
        method: "POST",
        data: values,
      });
    },
    onSuccess: () => {
      toast({
        title: "Анкета создана",
        description: "Бизнес-анкета успешно создана",
      });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/campaigns/${campaignId}/questionnaire`] 
      });
      
      if (onQuestionnaireUpdated) {
        onQuestionnaireUpdated();
      }
      
      setIsEditMode(false);
    },
    onError: (error: Error) => {
      console.error("Ошибка создания анкеты:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось создать анкету. Пожалуйста, попробуйте еще раз.",
        variant: "destructive",
      });
    },
  });

  // Мутация для обновления существующей анкеты
  const updateQuestionnaireMutation = useMutation({
    mutationFn: async (values: BusinessQuestionnaireFormValues) => {
      const questionnaireId = questionnaireData?.data?.id;
      return apiRequest(`/api/campaigns/${campaignId}/questionnaire/${questionnaireId}`, {
        method: "PATCH",
        data: values,
      });
    },
    onSuccess: () => {
      toast({
        title: "Анкета обновлена",
        description: "Бизнес-анкета успешно обновлена",
      });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/campaigns/${campaignId}/questionnaire`] 
      });
      
      if (onQuestionnaireUpdated) {
        onQuestionnaireUpdated();
      }
      
      setIsEditMode(false);
    },
    onError: (error: Error) => {
      console.error("Ошибка обновления анкеты:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить анкету. Пожалуйста, попробуйте еще раз.",
        variant: "destructive",
      });
    },
  });

  // Обработчик отправки формы
  const onSubmit = async (values: BusinessQuestionnaireFormValues) => {
    if (questionnaireData?.data) {
      // Обновляем существующую анкету
      await updateQuestionnaireMutation.mutateAsync(values);
    } else {
      // Создаем новую анкету
      await createQuestionnaireMutation.mutateAsync(values);
    }
  };

  // Обработчик анализа веб-сайта
  const analyzeWebsite = async () => {
    if (!websiteUrl) return;

    setIsAnalyzing(true);
    try {
      const response = await apiRequest(`/api/website-analysis`, {
        method: "POST",
        data: { 
          url: websiteUrl,
          campaignId 
        },
      });

      if (response?.data) {
        // Заполнение формы данными из анализа
        const analysisData = response.data;
        
        form.setValue("companyName", analysisData.companyName || form.getValues("companyName"));
        form.setValue("businessDescription", analysisData.businessDescription || form.getValues("businessDescription"));
        form.setValue("mainDirections", analysisData.mainDirections || form.getValues("mainDirections"));
        form.setValue("productsServices", analysisData.productsServices || form.getValues("productsServices"));
        form.setValue("targetAudience", analysisData.targetAudience || form.getValues("targetAudience"));
        form.setValue("brandImage", analysisData.brandImage || form.getValues("brandImage"));
        form.setValue("companyFeatures", analysisData.companyFeatures || form.getValues("companyFeatures"));
        form.setValue("businessValues", analysisData.businessValues || form.getValues("businessValues"));
        form.setValue("competitiveAdvantages", analysisData.competitiveAdvantages || form.getValues("competitiveAdvantages"));
        
        // Сохраняем URL сайта в контактную информацию, если она пуста
        if (!form.getValues("contactInfo")) {
          form.setValue("contactInfo", websiteUrl);
        }
        
        toast({
          title: "Анализ завершен",
          description: "Данные о компании извлечены из сайта",
        });
      }
    } catch (error) {
      console.error("Ошибка при анализе сайта:", error);
      toast({
        title: "Ошибка анализа",
        description: "Не удалось проанализировать сайт. Пожалуйста, проверьте URL и попробуйте снова.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Обработчик переключения режима редактирования
  const toggleEditMode = () => {
    if (isEditMode) {
      // Если выходим из режима редактирования, сбрасываем форму к начальным значениям
      if (questionnaireData?.data) {
        const questionnaire = questionnaireData.data;
        form.reset({
          companyName: questionnaire.companyName || "",
          contactInfo: questionnaire.contactInfo || "",
          businessDescription: questionnaire.businessDescription || "",
          mainDirections: questionnaire.mainDirections || "",
          brandImage: questionnaire.brandImage || "",
          productsServices: questionnaire.productsServices || "",
          targetAudience: questionnaire.targetAudience || "",
          customerResults: questionnaire.customerResults || "",
          companyFeatures: questionnaire.companyFeatures || "",
          businessValues: questionnaire.businessValues || "",
          productBeliefs: questionnaire.productBeliefs || "",
          competitiveAdvantages: questionnaire.competitiveAdvantages || "",
          marketingExpectations: questionnaire.marketingExpectations || "",
        });
      } else {
        form.reset();
      }
    }
    setIsEditMode(!isEditMode);
  };

  // Определяем, есть ли уже анкета для данной кампании
  const hasQuestionnaire = Boolean(questionnaireData?.data);

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Бизнес-анкета</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-40">
            <p>Загрузка данных...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Бизнес-анкета</CardTitle>
        <div className="flex gap-2">
          {isEditMode && (
            <Dialog open={isWebsiteDialogOpen} onOpenChange={setIsWebsiteDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="flex items-center gap-1"
                >
                  <Search className="h-4 w-4" />
                  Анализ сайта
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Анализ сайта компании</DialogTitle>
                  <DialogDescription>
                    Введите URL сайта компании для автоматического заполнения анкеты на основе данных с сайта.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="website-url" className="text-sm font-medium">
                      URL сайта компании
                    </label>
                    <Input
                      id="website-url"
                      placeholder="https://example.com"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsWebsiteDialogOpen(false)}
                  >
                    Отмена
                  </Button>
                  <Button
                    onClick={() => {
                      analyzeWebsite();
                      setIsWebsiteDialogOpen(false);
                    }}
                    disabled={!websiteUrl || isAnalyzing}
                  >
                    {isAnalyzing ? "Анализ..." : "Анализировать"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {hasQuestionnaire && (
            <Button 
              variant={isEditMode ? "outline" : "default"} 
              onClick={toggleEditMode}
            >
              {isEditMode ? "Отмена" : "Редактировать"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasQuestionnaire && !isEditMode ? (
          <div className="flex flex-col items-center py-8">
            <p className="text-muted-foreground mb-4 text-center">
              Для этой кампании еще не создана бизнес-анкета. 
              Заполните анкету, чтобы помочь в создании релевантного контента.
            </p>
            <Button onClick={() => setIsEditMode(true)}>
              Создать анкету
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form 
              onSubmit={form.handleSubmit(onSubmit)} 
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Название компании</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          readOnly={!isEditMode && hasQuestionnaire}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="contactInfo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Контактная информация</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          readOnly={!isEditMode && hasQuestionnaire}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="businessDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Описание бизнеса</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        readOnly={!isEditMode && hasQuestionnaire}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="mainDirections"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Основные направления деятельности</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        readOnly={!isEditMode && hasQuestionnaire}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="brandImage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Образ бренда</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        readOnly={!isEditMode && hasQuestionnaire}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="productsServices"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Продукты и услуги</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        readOnly={!isEditMode && hasQuestionnaire}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="targetAudience"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Целевая аудитория</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        readOnly={!isEditMode && hasQuestionnaire}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customerResults"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Какие результаты получают клиенты</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        readOnly={!isEditMode && hasQuestionnaire}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="companyFeatures"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Особенности компании</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        readOnly={!isEditMode && hasQuestionnaire}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="businessValues"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ценности бизнеса</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        readOnly={!isEditMode && hasQuestionnaire}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="productBeliefs"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Убеждения о продукте/услуге</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        readOnly={!isEditMode && hasQuestionnaire}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="competitiveAdvantages"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Конкурентные преимущества</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        readOnly={!isEditMode && hasQuestionnaire}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="marketingExpectations"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ожидания от маркетинга</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        readOnly={!isEditMode && hasQuestionnaire}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isEditMode && (
                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={toggleEditMode}
                  >
                    Отмена
                  </Button>
                  <Button 
                    type="submit"
                    disabled={createQuestionnaireMutation.isPending || updateQuestionnaireMutation.isPending}
                  >
                    {hasQuestionnaire ? "Обновить" : "Сохранить"}
                  </Button>
                </div>
              )}
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}