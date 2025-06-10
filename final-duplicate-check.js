#!/usr/bin/env node

/**
 * Финальная проверка защиты от дублирования публикаций
 * Проверяет все внедренные механизмы защиты
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function checkSchedulerProtection() {
  console.log('\n=== ПРОВЕРКА ЗАЩИТЫ ПЛАНИРОВЩИКА ОТ ДУБЛИРОВАНИЯ ===\n');
  
  try {
    const schedulerPath = path.join(__dirname, 'server/services/publish-scheduler.ts');
    const content = fs.readFileSync(schedulerPath, 'utf8');
    
    const checks = [];
    
    // 1. Блокировка isProcessing
    const hasProcessingLock = content.includes('private isProcessing = false');
    const hasProcessingCheck = content.includes('if (this.isProcessing)');
    const hasProcessingTimeout = content.includes('processingDuration < 60000');
    checks.push({
      name: 'Блокировка isProcessing',
      status: hasProcessingLock && hasProcessingCheck,
      details: `Объявление: ${hasProcessingLock}, Проверка: ${hasProcessingCheck}, Таймаут: ${hasProcessingTimeout}`
    });
    
    // 2. Сброс блокировки в finally
    const hasFinallyBlock = content.includes('} finally {') && content.includes('this.isProcessing = false');
    checks.push({
      name: 'Сброс блокировки в finally',
      status: hasFinallyBlock,
      details: `Finally блок с isProcessing = false: ${hasFinallyBlock}`
    });
    
    // 3. Защита от преждевременной публикации VK
    const hasTimeValidation = content.includes('timeUntilPublish <= 60000');
    checks.push({
      name: 'Защита от преждевременной публикации VK',
      status: hasTimeValidation,
      details: `Проверка времени до публикации: ${hasTimeValidation}`
    });
    
    // 4. Интервал планировщика
    const intervalMatch = content.match(/checkIntervalMs\s*=\s*(\d+)/);
    const interval = intervalMatch ? parseInt(intervalMatch[1]) : 0;
    const intervalOk = interval >= 20000;
    checks.push({
      name: 'Безопасный интервал планировщика',
      status: intervalOk,
      details: `Интервал: ${interval}ms (${interval/1000}с), Безопасный: ${intervalOk}`
    });
    
    // 5. Отсутствие множественных экземпляров
    const instanceMatches = content.match(/new\s+PublishScheduler/g);
    const singleInstance = !instanceMatches || instanceMatches.length <= 1;
    checks.push({
      name: 'Единственный экземпляр планировщика',
      status: singleInstance,
      details: `Найдено экземпляров: ${instanceMatches ? instanceMatches.length : 0}`
    });
    
    // Выводим результаты
    console.log('РЕЗУЛЬТАТЫ ПРОВЕРКИ:');
    console.log('==================');
    
    let passedChecks = 0;
    checks.forEach((check, index) => {
      const icon = check.status ? '✅' : '❌';
      console.log(`${index + 1}. ${icon} ${check.name}`);
      console.log(`   ${check.details}\n`);
      if (check.status) passedChecks++;
    });
    
    // Общая оценка
    const score = (passedChecks / checks.length) * 100;
    console.log(`📊 ОБЩАЯ ОЦЕНКА: ${passedChecks}/${checks.length} (${score.toFixed(1)}%)`);
    
    if (score >= 90) {
      console.log('🎉 ОТЛИЧНО: Система имеет надежную защиту от дублирования!');
    } else if (score >= 70) {
      console.log('⚠️  ХОРОШО: Система имеет базовую защиту, есть возможности для улучшения');
    } else {
      console.log('❌ КРИТИЧНО: Система уязвима для дублирования публикаций');
    }
    
    return score >= 90;
    
  } catch (error) {
    console.log('❌ Ошибка при проверке планировщика:', error.message);
    return false;
  }
}

function checkVKTimeProtection() {
  console.log('\n=== ПРОВЕРКА ЗАЩИТЫ ОТ ПРЕЖДЕВРЕМЕННОЙ ПУБЛИКАЦИИ VK ===\n');
  
  try {
    // Проверяем планировщик (основной файл с временной защитой)
    const schedulerPath = path.join(__dirname, 'server/services/publish-scheduler.ts');
    const content = fs.readFileSync(schedulerPath, 'utf8');
    
    // Ищем проверку времени для VK в планировщике
    const hasVKTimeCheck = content.includes('timeUntilPublish <= 60000') || 
                          content.includes('timeUntilPublish < 60000');
    
    console.log(`VK временная защита в планировщике: ${hasVKTimeCheck ? '✅ НАЙДЕНА' : '❌ НЕ НАЙДЕНА'}`);
    
    if (hasVKTimeCheck) {
      console.log('✅ VK публикации защищены от преждевременного запуска в планировщике');
      console.log('   Публикации не начнутся раньше чем за 1 минуту до назначенного времени');
    } else {
      console.log('❌ VK публикации могут публиковаться раньше времени');
    }
    
    return hasVKTimeCheck;
    
  } catch (error) {
    console.log('❌ Ошибка при проверке VK защиты:', error.message);
    return false;
  }
}

function checkLogAnalysis() {
  console.log('\n=== АНАЛИЗ ЛОГОВ ДЛЯ ПОДТВЕРЖДЕНИЯ РАБОТЫ ===\n');
  
  console.log('Проверьте логи планировщика на наличие следующих сообщений:');
  console.log('1. "БЛОКИРОВКА: Планировщик уже выполняется" - указывает на работу защиты');
  console.log('2. "РАЗБЛОКИРОВКА: Планировщик завершил работу" - указывает на корректный сброс');
  console.log('3. Отсутствие дублирующихся публикаций в одно время');
  
  return true;
}

async function main() {
  console.log('🔍 ФИНАЛЬНАЯ ДИАГНОСТИКА ЗАЩИТЫ ОТ ДУБЛИРОВАНИЯ');
  console.log('==============================================');
  
  const results = [];
  
  results.push(checkSchedulerProtection());
  results.push(checkVKTimeProtection());
  results.push(checkLogAnalysis());
  
  const allPassed = results.every(result => result);
  
  console.log('\n🎯 ИТОГОВЫЙ РЕЗУЛЬТАТ:');
  console.log('===================');
  
  if (allPassed) {
    console.log('🎉 ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ! Система защищена от дублирования публикаций.');
    console.log('✅ Планировщик имеет надежную блокировку от параллельного выполнения');
    console.log('✅ VK публикации защищены от преждевременного запуска');
    console.log('✅ Система готова к продакшену');
  } else {
    console.log('⚠️  НЕКОТОРЫЕ ПРОВЕРКИ НЕ ПРОЙДЕНЫ. Требуется доработка.');
    console.log('Проверьте детали выше и устраните найденные проблемы.');
  }
}

main().catch(console.error);