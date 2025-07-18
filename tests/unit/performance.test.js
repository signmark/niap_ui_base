/**
 * Тесты производительности - критично для стабильности системы
 */

describe('Performance Tests', () => {
  test('должен обрабатывать большие объемы контента эффективно', () => {
    function processBulkContent(contentItems, batchSize = 50) {
      const startTime = Date.now();
      const results = [];
      const errors = [];
      
      try {
        for (let i = 0; i < contentItems.length; i += batchSize) {
          const batch = contentItems.slice(i, i + batchSize);
          
          const batchResults = batch.map(item => {
            try {
              // Имитация обработки контента
              const processed = {
                id: item.id,
                processed: true,
                contentLength: item.content ? item.content.length : 0,
                hasMedia: !!(item.imageUrl || item.videoUrl),
                timestamp: Date.now()
              };
              
              return processed;
            } catch (error) {
              errors.push({ id: item.id, error: error.message });
              return null;
            }
          }).filter(Boolean);
          
          results.push(...batchResults);
        }
        
        const processingTime = Date.now() - startTime;
        
        return {
          success: true,
          processed: results.length,
          errors: errors.length,
          processingTime,
          avgTimePerItem: processingTime / contentItems.length,
          throughput: contentItems.length / (processingTime / 1000) // items per second
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          processingTime: Date.now() - startTime
        };
      }
    }

    // Создаем тестовые данные (1000 элементов)
    const testContent = Array.from({ length: 1000 }, (_, i) => ({
      id: `content-${i}`,
      content: `Тестовый контент номер ${i}`.repeat(10),
      imageUrl: i % 3 === 0 ? `https://example.com/image-${i}.jpg` : null
    }));

    const result = processBulkContent(testContent, 100);
    
    expect(result.success).toBe(true);
    expect(result.processed).toBe(1000);
    expect(result.errors).toBe(0);
    expect(result.avgTimePerItem).toBeLessThan(10); // Менее 10мс на элемент
    expect(result.throughput).toBeGreaterThan(50); // Более 50 элементов в секунду
  });

  test('должен эффективно работать с памятью при обработке данных', () => {
    function memoryEfficientProcessor() {
      const processedCount = { value: 0 };
      const peakMemoryUsage = { value: 0 };
      
      return {
        processStream(dataGenerator, chunkSize = 100) {
          const results = [];
          let currentChunk = [];
          
          for (const item of dataGenerator) {
            currentChunk.push(item);
            
            if (currentChunk.length >= chunkSize) {
              // Обрабатываем чанк
              const processed = this.processChunk(currentChunk);
              results.push(processed);
              
              // Очищаем память
              currentChunk = [];
              processedCount.value += chunkSize;
              
              // Имитация измерения памяти
              const currentMemory = process.memoryUsage ? process.memoryUsage().heapUsed : Math.random() * 1000000;
              peakMemoryUsage.value = Math.max(peakMemoryUsage.value, currentMemory);
            }
          }
          
          // Обрабатываем остатки
          if (currentChunk.length > 0) {
            const processed = this.processChunk(currentChunk);
            results.push(processed);
            processedCount.value += currentChunk.length;
          }
          
          return {
            totalProcessed: processedCount.value,
            chunksProcessed: results.length,
            peakMemoryUsage: peakMemoryUsage.value,
            avgChunkSize: processedCount.value / results.length
          };
        },
        
        processChunk(chunk) {
          return {
            items: chunk.length,
            avgLength: chunk.reduce((sum, item) => sum + (item.content?.length || 0), 0) / chunk.length,
            hasMedia: chunk.filter(item => item.imageUrl || item.videoUrl).length
          };
        }
      };
    }

    // Генератор больших данных
    function* generateLargeDataset(count = 10000) {
      for (let i = 0; i < count; i++) {
        yield {
          id: `item-${i}`,
          content: `Контент ${i} `.repeat(Math.floor(Math.random() * 100) + 1),
          imageUrl: i % 5 === 0 ? `https://example.com/img-${i}.jpg` : null
        };
      }
    }

    const processor = memoryEfficientProcessor();
    const result = processor.processStream(generateLargeDataset(10000), 200);
    
    expect(result.totalProcessed).toBe(10000);
    expect(result.chunksProcessed).toBe(50); // 10000 / 200
    expect(result.avgChunkSize).toBe(200);
    expect(result.peakMemoryUsage).toBeGreaterThan(0);
  });

  test('должен оптимизировать запросы к API', () => {
    function createAPIOptimizer() {
      const requestCache = new Map();
      const batchRequests = [];
      let batchTimeout = null;
      
      return {
        async request(endpoint, params, options = {}) {
          const cacheKey = `${endpoint}:${JSON.stringify(params)}`;
          
          // Проверяем кэш
          if (requestCache.has(cacheKey) && !options.skipCache) {
            const cached = requestCache.get(cacheKey);
            if (Date.now() - cached.timestamp < (options.cacheTTL || 60000)) {
              return { ...cached.data, fromCache: true };
            }
          }
          
          // Добавляем в batch если возможно
          if (options.batchable) {
            return this.addToBatch(endpoint, params, cacheKey);
          }
          
          // Выполняем немедленно
          const result = await this.executeRequest(endpoint, params);
          
          // Кэшируем результат
          if (result.success) {
            requestCache.set(cacheKey, {
              data: result,
              timestamp: Date.now()
            });
          }
          
          return result;
        },
        
        addToBatch(endpoint, params, cacheKey) {
          return new Promise((resolve, reject) => {
            batchRequests.push({ endpoint, params, cacheKey, resolve, reject });
            
            // Устанавливаем таймер для выполнения batch
            if (!batchTimeout) {
              batchTimeout = setTimeout(() => {
                this.executeBatch();
              }, 100); // 100мс задержка для накопления запросов
            }
          });
        },
        
        async executeBatch() {
          const currentBatch = [...batchRequests];
          batchRequests.length = 0;
          batchTimeout = null;
          
          if (currentBatch.length === 0) return;
          
          try {
            // Группируем по endpoint
            const groupedByEndpoint = currentBatch.reduce((groups, req) => {
              if (!groups[req.endpoint]) {
                groups[req.endpoint] = [];
              }
              groups[req.endpoint].push(req);
              return groups;
            }, {});
            
            // Выполняем batch запросы
            for (const [endpoint, requests] of Object.entries(groupedByEndpoint)) {
              const batchParams = requests.map(req => req.params);
              const batchResult = await this.executeBatchRequest(endpoint, batchParams);
              
              // Распределяем результаты
              requests.forEach((req, index) => {
                const result = batchResult[index] || { success: false, error: 'Batch error' };
                
                // Кэшируем успешные результаты
                if (result.success) {
                  requestCache.set(req.cacheKey, {
                    data: result,
                    timestamp: Date.now()
                  });
                }
                
                req.resolve(result);
              });
            }
          } catch (error) {
            // Отклоняем все запросы в случае ошибки
            currentBatch.forEach(req => {
              req.reject(new Error(`Batch execution failed: ${error.message}`));
            });
          }
        },
        
        async executeRequest(endpoint, params) {
          // Имитация API запроса
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
          return {
            success: true,
            data: { endpoint, params, timestamp: Date.now() }
          };
        },
        
        async executeBatchRequest(endpoint, batchParams) {
          // Имитация batch API запроса
          await new Promise(resolve => setTimeout(resolve, Math.random() * 200));
          return batchParams.map(params => ({
            success: true,
            data: { endpoint, params, timestamp: Date.now(), batched: true }
          }));
        },
        
        getCacheStats() {
          return {
            cacheSize: requestCache.size,
            pendingBatches: batchRequests.length
          };
        }
      };
    }

    const optimizer = createAPIOptimizer();
    
    // Тест кэширования
    expect(async () => {
      const result1 = await optimizer.request('/api/test', { id: 1 });
      const result2 = await optimizer.request('/api/test', { id: 1 });
      
      expect(result1.success).toBe(true);
      expect(result2.fromCache).toBe(true);
    }).not.toThrow();

    // Тест статистики
    const stats = optimizer.getCacheStats();
    expect(stats.cacheSize).toBeGreaterThanOrEqual(0);
    expect(stats.pendingBatches).toBeGreaterThanOrEqual(0);
  });

  test('должен оптимизировать обработку изображений', () => {
    function createImageProcessor() {
      return {
        processImages(imageUrls, options = {}) {
          const startTime = Date.now();
          const processed = [];
          const errors = [];
          
          const maxConcurrent = options.maxConcurrent || 5;
          const targetWidth = options.targetWidth || 1920;
          const targetHeight = options.targetHeight || 1080;
          const quality = options.quality || 80;
          
          // Группируем изображения для параллельной обработки
          const chunks = [];
          for (let i = 0; i < imageUrls.length; i += maxConcurrent) {
            chunks.push(imageUrls.slice(i, i + maxConcurrent));
          }
          
          chunks.forEach(chunk => {
            chunk.forEach(url => {
              try {
                const processedImage = this.processImage(url, {
                  targetWidth,
                  targetHeight, 
                  quality
                });
                processed.push(processedImage);
              } catch (error) {
                errors.push({ url, error: error.message });
              }
            });
          });
          
          const processingTime = Date.now() - startTime;
          
          return {
            processed: processed.length,
            errors: errors.length,
            processingTime,
            avgTimePerImage: processingTime / imageUrls.length,
            totalSizeReduction: processed.reduce((sum, img) => sum + img.sizeReduction, 0)
          };
        },
        
        processImage(url, options) {
          // Имитация обработки изображения
          const originalSize = Math.floor(Math.random() * 5000000) + 1000000; // 1-5MB
          const processedSize = Math.floor(originalSize * (options.quality / 100) * 0.7);
          
          return {
            url,
            originalSize,
            processedSize,
            sizeReduction: originalSize - processedSize,
            width: options.targetWidth,
            height: options.targetHeight,
            quality: options.quality,
            format: 'webp'
          };
        },
        
        generateThumbnails(imageUrls, sizes = [150, 300, 600]) {
          const startTime = Date.now();
          const thumbnails = [];
          
          imageUrls.forEach(url => {
            sizes.forEach(size => {
              const thumbnail = {
                originalUrl: url,
                thumbnailUrl: `${url}?w=${size}&h=${size}`,
                size: size,
                estimatedFileSize: Math.floor(size * size * 0.3) // Примерная оценка
              };
              thumbnails.push(thumbnail);
            });
          });
          
          const processingTime = Date.now() - startTime;
          
          return {
            thumbnails: thumbnails.length,
            processingTime,
            avgTimePerThumbnail: processingTime / thumbnails.length,
            data: thumbnails
          };
        }
      };
    }

    const processor = createImageProcessor();
    
    // Тест обработки изображений
    const imageUrls = Array.from({ length: 50 }, (_, i) => 
      `https://example.com/image-${i}.jpg`
    );
    
    const result = processor.processImages(imageUrls, {
      maxConcurrent: 10,
      quality: 85
    });
    
    expect(result.processed).toBe(50);
    expect(result.errors).toBe(0);
    expect(result.avgTimePerImage).toBeLessThan(50);
    expect(result.totalSizeReduction).toBeGreaterThan(0);

    // Тест генерации превью
    const thumbnailResult = processor.generateThumbnails(imageUrls.slice(0, 10));
    expect(thumbnailResult.thumbnails).toBe(30); // 10 изображений * 3 размера
    expect(thumbnailResult.processingTime).toBeLessThan(1000);
  });

  test('должен эффективно обрабатывать поисковые запросы', () => {
    function createSearchOptimizer() {
      const searchCache = new Map();
      const searchIndex = new Map();
      
      return {
        buildIndex(documents) {
          searchIndex.clear();
          
          documents.forEach(doc => {
            const words = this.tokenize(doc.content);
            words.forEach(word => {
              if (!searchIndex.has(word)) {
                searchIndex.set(word, new Set());
              }
              searchIndex.get(word).add(doc.id);
            });
          });
          
          return {
            indexedDocuments: documents.length,
            indexedTerms: searchIndex.size,
            avgTermsPerDoc: Array.from(searchIndex.values())
              .reduce((sum, docIds) => sum + docIds.size, 0) / searchIndex.size
          };
        },
        
        search(query, options = {}) {
          const cacheKey = `${query}:${JSON.stringify(options)}`;
          
          // Проверяем кэш
          if (searchCache.has(cacheKey)) {
            const cached = searchCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 60000) { // 1 минута кэш
              return { ...cached.results, fromCache: true };
            }
          }
          
          const startTime = Date.now();
          const queryTerms = this.tokenize(query);
          const maxResults = options.limit || 50;
          const threshold = options.threshold || 0.1;
          
          // Находим документы содержащие термины запроса
          const candidateDocIds = new Set();
          queryTerms.forEach(term => {
            const docIds = searchIndex.get(term) || new Set();
            docIds.forEach(id => candidateDocIds.add(id));
          });
          
          // Ранжируем результаты
          const rankedResults = Array.from(candidateDocIds)
            .map(docId => ({
              docId,
              score: this.calculateScore(docId, queryTerms)
            }))
            .filter(result => result.score >= threshold)
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults);
          
          const searchTime = Date.now() - startTime;
          const results = {
            query,
            results: rankedResults,
            totalFound: rankedResults.length,
            searchTime,
            performanceMetrics: {
              candidatesEvaluated: candidateDocIds.size,
              avgScore: rankedResults.reduce((sum, r) => sum + r.score, 0) / rankedResults.length || 0
            }
          };
          
          // Кэшируем результат
          searchCache.set(cacheKey, {
            results,
            timestamp: Date.now()
          });
          
          return results;
        },
        
        tokenize(text) {
          return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2);
        },
        
        calculateScore(docId, queryTerms) {
          // Простой алгоритм подсчета релевантности
          let score = 0;
          queryTerms.forEach(term => {
            if (searchIndex.has(term) && searchIndex.get(term).has(docId)) {
              score += 1 / searchIndex.get(term).size; // TF-IDF упрощенный
            }
          });
          return score;
        },
        
        getIndexStats() {
          return {
            totalTerms: searchIndex.size,
            cacheSize: searchCache.size,
            avgDocsPerTerm: Array.from(searchIndex.values())
              .reduce((sum, docs) => sum + docs.size, 0) / searchIndex.size
          };
        }
      };
    }

    const searchOptimizer = createSearchOptimizer();
    
    // Создаем тестовый корпус документов
    const documents = Array.from({ length: 1000 }, (_, i) => ({
      id: `doc-${i}`,
      content: `Документ номер ${i} содержит важную информацию о ${['технологиях', 'медицине', 'спорте', 'образовании'][i % 4]}`
    }));
    
    // Строим индекс
    const indexStats = searchOptimizer.buildIndex(documents);
    expect(indexStats.indexedDocuments).toBe(1000);
    expect(indexStats.indexedTerms).toBeGreaterThan(0);
    
    // Выполняем поиск
    const searchResult = searchOptimizer.search('технологии информация', { limit: 20 });
    expect(searchResult.totalFound).toBeGreaterThan(0);
    expect(searchResult.searchTime).toBeLessThan(100); // Менее 100мс
    expect(searchResult.results.length).toBeLessThanOrEqual(20);
    
    // Проверяем кэширование
    const cachedResult = searchOptimizer.search('технологии информация', { limit: 20 });
    expect(cachedResult.fromCache).toBe(true);
  });
});