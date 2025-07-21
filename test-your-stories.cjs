const axios = require('axios');

async function publishYourStories() {
  try {
    console.log('Публикация ваших Stories с текстом "1й", "2й", "3й"...');
    
    const slides = [
      {
        id: "slide-1751887322914",
        order: 0,
        duration: 5,
        background: {"type": "color", "value": "#6366f1"},
        elements: [{
          id: "element-1751887369421-mt7n2unwh",
          type: "text",
          content: {"text": "1й"},
          position: {"x": 50, "y": 50},
          rotation: 0,
          zIndex: 1,
          style: {
            fontSize: 40,
            fontFamily: "Arial", 
            color: "#FFFFFF",
            fontWeight: "bold",
            textAlign: "center"
          }
        }]
      },
      {
        id: "slide-1751887464828",
        order: 1,
        duration: 5,
        background: {"type": "color", "value": "#6366f1"},
        elements: [{
          id: "element-1751887467688-yzg5q6ugx",
          type: "text",
          content: {"text": "2й"},
          position: {"x": 50, "y": 50},
          rotation: 0,
          zIndex: 1,
          style: {
            fontSize: 40,
            fontFamily: "Arial",
            color: "#FFFFFF", 
            fontWeight: "bold",
            textAlign: "center"
          }
        }]
      },
      {
        id: "slide-1751887621887",
        order: 2,
        duration: 5,
        background: {"type": "color", "value": "#6366f1"},
        elements: [{
          id: "element-1751887626144-ve4jm7g4u",
          type: "text",
          content: {"text": "3й"},
          position: {"x": 50, "y": 50},
          rotation: 0,
          zIndex: 1,
          style: {
            fontSize: 40,
            fontFamily: "Arial",
            color: "#FFFFFF",
            fontWeight: "bold", 
            textAlign: "center"
          }
        }]
      }
    ];

    // Публикуем каждый слайд отдельно для надёжности
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const slideText = slide.elements[0].content.text;
      
      console.log(`\nПубликуем слайд ${i + 1}/3: "${slideText}"`);
      
      const response = await axios.post('http://localhost:5000/api/instagram-stories/publish-simple', {
        username: 'darkhorse_fashion',
        password: 'QtpZ3dh70306',
        text: slideText, // Текст для генерации изображения
        backgroundColor: '#6366f1', // Синий фон как у ваших слайдов
        textColor: '#FFFFFF', // Белый текст
        caption: `${slideText} - слайд ${i + 1} из ваших Stories`
      }, {
        timeout: 60000
      });
      
      if (response.data.success) {
        console.log(`✅ Слайд ${i + 1} опубликован: ${response.data.storyUrl}`);
      } else {
        console.log(`❌ Ошибка публикации слайда ${i + 1}: ${response.data.error}`);
      }
      
      // Пауза между публикациями
      if (i < slides.length - 1) {
        console.log('Пауза 3 секунды...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    console.log('\n🎉 Все слайды ваших Stories опубликованы!');
    
  } catch (error) {
    console.error('Ошибка:', error.message);
    if (error.response) {
      console.error('Детали:', error.response.data);
    }
  }
}

publishYourStories();