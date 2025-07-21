const fs = require('fs');

let content = fs.readFileSync('server/api/social-publishing-router.ts', 'utf8');

// Заменяем все require statements для instagram-private-service
content = content.replace(
  /const InstagramPrivateService = require\('\.\.\/services\/instagram-private-service'\);/g,
  'const { default: InstagramPrivateService } = await import(\'../services/instagram-private-service.js\');'
);

// Также заменяем создание экземпляра (так как это теперь импорт default singleton)
content = content.replace(
  /const igService = new InstagramPrivateService\(\);/g,
  'const igService = InstagramPrivateService;'
);

fs.writeFileSync('server/api/social-publishing-router.ts', content);

console.log('✅ Исправлены импорты в social-publishing-router.ts');