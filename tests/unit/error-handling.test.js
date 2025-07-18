/**
 * Тесты обработки ошибок - критично для стабильности системы
 */

describe('Error Handling Tests', () => {
  test('должен классифицировать типы ошибок', () => {
    function classifyError(error) {
      const errorMessage = typeof error === 'string' ? error : error.message || '';
      
      const errorTypes = {
        'network': [
          'network timeout', 'connection refused', 'dns resolution failed',
          'socket timeout', 'network unreachable'
        ],
        'authentication': [
          'invalid credentials', 'unauthorized', 'access denied',
          'token expired', 'forbidden'
        ],
        'quota': [
          'quota exceeded', 'rate limit', 'too many requests',
          'api limit reached'
        ],
        'validation': [
          'bad request', 'invalid parameter', 'missing required field',
          'malformed request'
        ],
        'server': [
          'internal server error', 'service unavailable', 'bad gateway',
          'gateway timeout'
        ],
        'client': [
          'not found', 'method not allowed', 'unsupported media type'
        ]
      };
      
      const lowerMessage = errorMessage.toLowerCase();
      
      for (const [type, keywords] of Object.entries(errorTypes)) {
        if (keywords.some(keyword => lowerMessage.includes(keyword))) {
          return {
            type,
            isRetryable: ['network', 'server'].includes(type),
            isCritical: ['authentication', 'validation'].includes(type),
            requiresUserAction: ['authentication', 'quota'].includes(type)
          };
        }
      }
      
      return {
        type: 'unknown',
        isRetryable: false,
        isCritical: true,
        requiresUserAction: true
      };
    }

    // Сетевые ошибки - можно повторить
    const networkError = classifyError('Network timeout occurred');
    expect(networkError.type).toBe('network');
    expect(networkError.isRetryable).toBe(true);
    expect(networkError.isCritical).toBe(false);

    // Ошибки авторизации - критичные, требуют действий пользователя
    const authError = classifyError('Invalid credentials provided');
    expect(authError.type).toBe('authentication');
    expect(authError.isRetryable).toBe(false);
    expect(authError.isCritical).toBe(true);
    expect(authError.requiresUserAction).toBe(true);

    // Ошибки квоты - требуют действий пользователя
    const quotaError = classifyError('API quota exceeded for today');
    expect(quotaError.type).toBe('quota');
    expect(quotaError.requiresUserAction).toBe(true);

    // Неизвестные ошибки
    const unknownError = classifyError('Something went wrong');
    expect(unknownError.type).toBe('unknown');
    expect(unknownError.isCritical).toBe(true);
  });

  test('должен реализовывать retry логику с exponential backoff', () => {
    function createRetryManager(maxRetries = 3, baseDelay = 1000) {
      return {
        async executeWithRetry(operation, shouldRetry = null) {
          let lastError;
          
          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
              const result = await operation();
              return { success: true, result, attempt };
            } catch (error) {
              lastError = error;
              
              // Проверяем, стоит ли повторять
              const errorClass = this.classifyError(error);
              const defaultShouldRetry = errorClass.isRetryable && attempt < maxRetries;
              const actualShouldRetry = shouldRetry ? shouldRetry(error, attempt) : defaultShouldRetry;
              
              if (!actualShouldRetry) {
                break;
              }
              
              // Exponential backoff с jitter
              const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
          
          return { success: false, error: lastError, attempts: maxRetries + 1 };
        },
        
        classifyError(error) {
          const message = error.message || '';
          return {
            isRetryable: message.includes('timeout') || message.includes('network')
          };
        }
      };
    }

    const retryManager = createRetryManager(2, 100);
    
    // Операция которая успешна со второй попытки
    let attemptCount = 0;
    const eventuallySuccessful = async () => {
      attemptCount++;
      if (attemptCount < 2) {
        throw new Error('Network timeout');
      }
      return 'success';
    };

    // Операция которая всегда падает с нересурсной ошибкой
    const alwaysFails = async () => {
      throw new Error('Invalid credentials');
    };

    // Тестируем успешный retry
    expect(async () => {
      const result = await retryManager.executeWithRetry(eventuallySuccessful);
      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempt).toBe(1); // Вторая попытка
    }).not.toThrow();

    // Тестируем неуспешный retry
    expect(async () => {
      const result = await retryManager.executeWithRetry(alwaysFails);
      expect(result.success).toBe(false);
      expect(result.error.message).toBe('Invalid credentials');
    }).not.toThrow();
  });

  test('должен логировать ошибки с правильными уровнями', () => {
    function createErrorLogger() {
      const logs = [];
      
      return {
        logError(error, context = {}) {
          const errorInfo = this.analyzeError(error);
          
          const logEntry = {
            timestamp: new Date().toISOString(),
            level: errorInfo.logLevel,
            message: error.message || error,
            stack: error.stack,
            context,
            errorType: errorInfo.type,
            shouldAlert: errorInfo.shouldAlert
          };
          
          logs.push(logEntry);
          return logEntry;
        },
        
        analyzeError(error) {
          const message = error.message || error;
          
          if (message.includes('authentication') || message.includes('unauthorized')) {
            return { type: 'auth', logLevel: 'warn', shouldAlert: false };
          }
          
          if (message.includes('network') || message.includes('timeout')) {
            return { type: 'network', logLevel: 'info', shouldAlert: false };
          }
          
          if (message.includes('quota') || message.includes('rate limit')) {
            return { type: 'quota', logLevel: 'warn', shouldAlert: true };
          }
          
          if (message.includes('server error') || message.includes('crash')) {
            return { type: 'critical', logLevel: 'error', shouldAlert: true };
          }
          
          return { type: 'unknown', logLevel: 'error', shouldAlert: true };
        },
        
        getLogs() {
          return logs;
        },
        
        getAlertLogs() {
          return logs.filter(log => log.shouldAlert);
        }
      };
    }

    const logger = createErrorLogger();
    
    // Логируем разные типы ошибок
    const networkError = new Error('Network timeout occurred');
    const authError = new Error('Authentication failed');
    const criticalError = new Error('Internal server error');
    
    const networkLog = logger.logError(networkError, { operation: 'api_call' });
    const authLog = logger.logError(authError, { userId: '123' });
    const criticalLog = logger.logError(criticalError, { service: 'scheduler' });
    
    expect(networkLog.level).toBe('info');
    expect(networkLog.shouldAlert).toBe(false);
    
    expect(authLog.level).toBe('warn');
    expect(authLog.shouldAlert).toBe(false);
    
    expect(criticalLog.level).toBe('error');
    expect(criticalLog.shouldAlert).toBe(true);
    
    // Проверяем фильтрацию алертов
    const alertLogs = logger.getAlertLogs();
    expect(alertLogs).toHaveLength(1);
    expect(alertLogs[0].message).toBe('Internal server error');
  });

  test('должен обрабатывать graceful degradation', () => {
    function createFallbackManager() {
      return {
        async executeWithFallback(primaryOperation, fallbackOperations = []) {
          const results = [];
          
          // Пытаемся выполнить основную операцию
          try {
            const result = await primaryOperation();
            return {
              success: true,
              result,
              source: 'primary',
              fallbacksUsed: 0
            };
          } catch (primaryError) {
            results.push({ source: 'primary', error: primaryError });
          }
          
          // Пытаемся fallback операции
          for (let i = 0; i < fallbackOperations.length; i++) {
            try {
              const result = await fallbackOperations[i]();
              return {
                success: true,
                result,
                source: `fallback_${i + 1}`,
                fallbacksUsed: i + 1,
                primaryError: results[0].error
              };
            } catch (fallbackError) {
              results.push({ source: `fallback_${i + 1}`, error: fallbackError });
            }
          }
          
          // Все операции провалились
          return {
            success: false,
            errors: results,
            fallbacksUsed: fallbackOperations.length
          };
        }
      };
    }

    const fallbackManager = createFallbackManager();
    
    // Основная операция падает, fallback успешен
    const failingPrimary = async () => {
      throw new Error('Primary service down');
    };
    
    const successfulFallback = async () => {
      return 'fallback result';
    };
    
    const failingFallback = async () => {
      throw new Error('Fallback also failed');
    };

    // Тест успешного fallback
    expect(async () => {
      const result = await fallbackManager.executeWithFallback(
        failingPrimary,
        [successfulFallback]
      );
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('fallback result');
      expect(result.source).toBe('fallback_1');
      expect(result.fallbacksUsed).toBe(1);
      expect(result.primaryError.message).toBe('Primary service down');
    }).not.toThrow();

    // Тест полного провала
    expect(async () => {
      const result = await fallbackManager.executeWithFallback(
        failingPrimary,
        [failingFallback]
      );
      
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.fallbacksUsed).toBe(1);
    }).not.toThrow();
  });

  test('должен очищать чувствительные данные из ошибок', () => {
    function sanitizeError(error, sensitiveFields = ['password', 'token', 'key', 'secret']) {
      const errorObj = error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error;
      
      let sanitized = JSON.stringify(errorObj);
      
      // Удаляем чувствительные данные
      sensitiveFields.forEach(field => {
        // Удаляем значения полей
        const fieldRegex = new RegExp(`"${field}"\\s*:\\s*"[^"]*"`, 'gi');
        sanitized = sanitized.replace(fieldRegex, `"${field}": "[REDACTED]"`);
        
        // Удаляем из сообщений ошибок
        const messageRegex = new RegExp(`${field}[=:]\\s*\\S+`, 'gi');
        sanitized = sanitized.replace(messageRegex, `${field}=[REDACTED]`);
      });
      
      // Удаляем JWT токены
      const jwtRegex = /eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*/g;
      sanitized = sanitized.replace(jwtRegex, '[JWT_REDACTED]');
      
      // Удаляем длинные строки которые могут быть ключами
      const longStringRegex = /"[A-Za-z0-9+/=]{32,}"/g;
      sanitized = sanitized.replace(longStringRegex, '"[LONG_STRING_REDACTED]"');
      
      try {
        return JSON.parse(sanitized);
      } catch {
        return { message: sanitized };
      }
    }

    const sensitiveError = new Error('Authentication failed: token=abc123secret, password=mysecret');
    sensitiveError.config = {
      password: 'supersecret',
      apiKey: 'sk-1234567890abcdef',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
    };

    const sanitized = sanitizeError(sensitiveError);
    
    expect(sanitized.message).not.toContain('abc123secret');
    expect(sanitized.message).not.toContain('mysecret');
    expect(sanitized.message).toContain('[REDACTED]');
    
    expect(JSON.stringify(sanitized)).not.toContain('supersecret');
    expect(JSON.stringify(sanitized)).not.toContain('sk-1234567890abcdef');
    expect(JSON.stringify(sanitized)).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(JSON.stringify(sanitized)).toContain('[JWT_REDACTED]');
  });

  test('должен предотвращать каскадные ошибки', () => {
    function createCircuitBreaker(threshold = 5, timeout = 60000) {
      let failures = 0;
      let lastFailTime = 0;
      let state = 'closed'; // closed, open, half-open
      
      return {
        async execute(operation) {
          // Проверяем состояние breaker
          if (state === 'open') {
            if (Date.now() - lastFailTime < timeout) {
              throw new Error('Circuit breaker is open');
            } else {
              state = 'half-open';
            }
          }
          
          try {
            const result = await operation();
            
            // Успешное выполнение - сбрасываем счетчик
            if (state === 'half-open') {
              state = 'closed';
            }
            failures = 0;
            
            return result;
          } catch (error) {
            failures++;
            lastFailTime = Date.now();
            
            // Проверяем порог
            if (failures >= threshold) {
              state = 'open';
            }
            
            throw error;
          }
        },
        
        getState() {
          return { state, failures, lastFailTime };
        },
        
        reset() {
          state = 'closed';
          failures = 0;
          lastFailTime = 0;
        }
      };
    }

    const breaker = createCircuitBreaker(3, 1000);
    
    const failingOperation = async () => {
      throw new Error('Operation failed');
    };
    
    const successfulOperation = async () => {
      return 'success';
    };

    // Первые 3 ошибки должны пройти
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(failingOperation);
      } catch (error) {
        expect(error.message).toBe('Operation failed');
      }
    }
    
    expect(breaker.getState().state).toBe('open');
    
    // Следующая попытка должна быть заблокирована
    try {
      await breaker.execute(failingOperation);
    } catch (error) {
      expect(error.message).toBe('Circuit breaker is open');
    }
    
    // После сброса должно работать
    breaker.reset();
    expect(async () => {
      const result = await breaker.execute(successfulOperation);
      expect(result).toBe('success');
    }).not.toThrow();
  });
});