#!/usr/bin/env python3
"""
Stories Image Generator API
Генерирует изображения из metadata Stories для публикации в социальных сетях
"""

import os
import io
import json
import base64
import requests
from PIL import Image, ImageDraw, ImageFont
from flask import Flask, request, jsonify
import tempfile
from urllib.parse import urlparse
from pathlib import Path

app = Flask(__name__)

# Настройки по умолчанию
DEFAULT_FONT_SIZE = 32
STORY_WIDTH = 1080
STORY_HEIGHT = 1920
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

def download_image(url):
    """Скачивает изображение по URL"""
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return Image.open(io.BytesIO(response.content))
    except Exception as e:
        print(f"Ошибка загрузки изображения {url}: {e}")
        return None

def get_font(size=DEFAULT_FONT_SIZE):
    """Получает шрифт заданного размера"""
    try:
        return ImageFont.truetype(FONT_PATH, size)
    except:
        try:
            # Fallback на системный шрифт
            return ImageFont.truetype("/System/Library/Fonts/Arial.ttf", size)
        except:
            # Fallback на базовый шрифт
            return ImageFont.load_default()

def draw_poll_element(draw, element, x, y):
    """Рисует элемент голосования"""
    poll_data = element.get('pollData', {})
    question = poll_data.get('question', 'Ваш вопрос?')
    options = poll_data.get('options', ['Вариант 1', 'Вариант 2'])
    
    font = get_font(28)
    option_font = get_font(24)
    
    # Рисуем вопрос
    draw.text((x, y), question, fill='#000000', font=font)
    
    # Рисуем варианты ответов
    option_y = y + 50
    for i, option in enumerate(options):
        # Фон для варианта
        option_bg = (x, option_y + i * 60, x + 400, option_y + i * 60 + 45)
        draw.rounded_rectangle(option_bg, radius=20, fill='#E3F2FD', outline='#2196F3', width=2)
        
        # Текст варианта
        draw.text((x + 20, option_y + i * 60 + 10), option, fill='#000000', font=option_font)

def draw_quiz_element(draw, element, x, y):
    """Рисует элемент викторины"""
    quiz_data = element.get('quizData', {})
    question = quiz_data.get('question', 'Вопрос викторины?')
    options = quiz_data.get('options', ['Вариант A', 'Вариант B'])
    correct_answer = quiz_data.get('correctAnswer', 0)
    
    font = get_font(26)
    option_font = get_font(22)
    
    # Рисуем вопрос
    draw.text((x, y), "🧠 " + question, fill='#000000', font=font)
    
    # Рисуем варианты
    option_y = y + 50
    for i, option in enumerate(options):
        # Цвет зависит от правильности ответа
        bg_color = '#4CAF50' if i == correct_answer else '#FF9800'
        
        option_bg = (x, option_y + i * 55, x + 350, option_y + i * 55 + 40)
        draw.rounded_rectangle(option_bg, radius=15, fill=bg_color, outline='#FFFFFF', width=2)
        
        draw.text((x + 15, option_y + i * 55 + 8), option, fill='#FFFFFF', font=option_font)

def draw_slider_element(draw, element, x, y):
    """Рисует элемент слайдера"""
    slider_data = element.get('sliderData', {})
    question = slider_data.get('question', 'Оцените от 1 до 10')
    min_label = slider_data.get('minLabel', '1')
    max_label = slider_data.get('maxLabel', '10')
    
    font = get_font(24)
    label_font = get_font(18)
    
    # Вопрос
    draw.text((x, y), question, fill='#000000', font=font)
    
    # Слайдер
    slider_y = y + 40
    slider_width = 300
    
    # Линия слайдера
    draw.line([(x, slider_y), (x + slider_width, slider_y)], fill='#9E9E9E', width=4)
    
    # Ползунок (в середине)
    slider_pos = x + slider_width // 2
    draw.ellipse([slider_pos - 15, slider_y - 15, slider_pos + 15, slider_y + 15], 
                 fill='#2196F3', outline='#FFFFFF', width=3)
    
    # Подписи
    draw.text((x, slider_y + 25), min_label, fill='#666666', font=label_font)
    draw.text((x + slider_width - 30, slider_y + 25), max_label, fill='#666666', font=label_font)

def draw_sticker_element(image, element, x, y):
    """Добавляет стикер"""
    sticker_data = element.get('stickerData', {})
    sticker_type = sticker_data.get('type', 'heart')
    size = sticker_data.get('size', 50)
    
    # Простые стикеры как эмодзи
    stickers = {
        'heart': '❤️',
        'fire': '🔥',
        'star': '⭐',
        'thumbs_up': '👍',
        'clap': '👏'
    }
    
    sticker_emoji = stickers.get(sticker_type, '❤️')
    draw = ImageDraw.Draw(image)
    font = get_font(size)
    draw.text((x, y), sticker_emoji, font=font)

def generate_slide_image(slide_data):
    """Генерирует изображение для одного слайда"""
    try:
        # Создаем базовое изображение
        image = Image.new('RGB', (STORY_WIDTH, STORY_HEIGHT), color='white')
        draw = ImageDraw.Draw(image)
        
        # Обрабатываем фон
        background = slide_data.get('background', {})
        if background.get('type') == 'color':
            color = background.get('color', '#ffffff')
            if color.startswith('#'):
                image = Image.new('RGB', (STORY_WIDTH, STORY_HEIGHT), color=color)
                draw = ImageDraw.Draw(image)
        elif background.get('type') == 'image':
            bg_url = background.get('value')
            if bg_url:
                bg_img = download_image(bg_url)
                if bg_img:
                    # Масштабируем фоновое изображение
                    bg_img = bg_img.resize((STORY_WIDTH, STORY_HEIGHT), Image.Resampling.LANCZOS)
                    image = bg_img
                    draw = ImageDraw.Draw(image)
        
        # Обрабатываем элементы
        elements = slide_data.get('elements', [])
        for element in elements:
            element_type = element.get('type')
            position = element.get('position', {})
            x = int(position.get('x', 0))
            y = int(position.get('y', 0))
            content = element.get('content', '')
            style = element.get('style', {})
            
            if element_type == 'text':
                # Рисуем текст
                font_size = int(style.get('fontSize', DEFAULT_FONT_SIZE))
                color = style.get('color', '#000000')
                font = get_font(font_size)
                
                # Многострочный текст
                lines = content.split('\n')
                line_height = font_size + 5
                
                for i, line in enumerate(lines):
                    line_y = y + (i * line_height)
                    draw.text((x, line_y), line, fill=color, font=font)
                    
            elif element_type == 'image':
                # Добавляем изображение
                img_url = content
                if img_url:
                    element_img = download_image(img_url)
                    if element_img:
                        width = int(style.get('width', 100))
                        height = int(style.get('height', 100))
                        
                        # Масштабируем изображение элемента
                        element_img = element_img.resize((width, height), Image.Resampling.LANCZOS)
                        
                        # Вставляем изображение
                        image.paste(element_img, (x, y))
                        
            elif element_type == 'poll':
                # Рисуем голосование
                draw_poll_element(draw, element, x, y)
                
            elif element_type == 'quiz':
                # Рисуем викторину
                draw_quiz_element(draw, element, x, y)
                
            elif element_type == 'slider':
                # Рисуем слайдер оценки
                draw_slider_element(draw, element, x, y)
                
            elif element_type == 'sticker':
                # Добавляем стикер
                draw_sticker_element(image, element, x, y)
        
        return image
        
    except Exception as e:
        print(f"Ошибка генерации слайда: {e}")
        return None

def upload_to_temp(image):
    """Сохраняет изображение во временный файл и возвращает URL"""
    try:
        # Создаем временный файл
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp_file:
            image.save(tmp_file.name, 'JPEG', quality=85)
            
            # В продакшене здесь должна быть загрузка на S3/CDN
            # Пока возвращаем локальный путь
            return f"/temp/{os.path.basename(tmp_file.name)}"
            
    except Exception as e:
        print(f"Ошибка сохранения изображения: {e}")
        return None

@app.route('/generate-stories', methods=['POST'])
def generate_stories():
    """API endpoint для генерации Stories изображений"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'Данные не предоставлены'}), 400
            
        # Получаем metadata Stories
        metadata = data.get('metadata', {})
        story_data = metadata.get('storyData', {})
        slides = story_data.get('slides', [])
        
        if not slides:
            return jsonify({'error': 'Слайды не найдены в metadata'}), 400
            
        generated_images = []
        
        # Генерируем изображение для каждого слайда
        for i, slide in enumerate(slides):
            print(f"Генерация слайда {i+1}/{len(slides)}")
            
            slide_image = generate_slide_image(slide)
            if slide_image:
                image_url = upload_to_temp(slide_image)
                if image_url:
                    generated_images.append({
                        'slideIndex': i,
                        'imageUrl': image_url,
                        'duration': slide.get('duration', 5)
                    })
                else:
                    print(f"Не удалось сохранить слайд {i+1}")
            else:
                print(f"Не удалось сгенерировать слайд {i+1}")
        
        if not generated_images:
            return jsonify({'error': 'Не удалось сгенерировать ни одного изображения'}), 500
            
        return jsonify({
            'success': True,
            'images': generated_images,
            'totalSlides': len(slides),
            'generatedCount': len(generated_images)
        })
        
    except Exception as e:
        print(f"Ошибка API: {e}")
        return jsonify({'error': f'Ошибка сервера: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Проверка работоспособности API"""
    return jsonify({'status': 'OK', 'service': 'Stories Generator'})

if __name__ == '__main__':
    print("🎨 Stories Generator API запущен")
    print(f"📐 Размер Stories: {STORY_WIDTH}x{STORY_HEIGHT}")
    app.run(host='0.0.0.0', port=5001, debug=True)