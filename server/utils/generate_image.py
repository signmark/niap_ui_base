#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from PIL import Image, ImageDraw, ImageFont
import sys
import os
import argparse
import textwrap

def hex_to_rgb(hex_color):
    """Преобразует hex цвет в RGB кортеж"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def create_stories_image(text, background_color='#6366f1', text_color='#FFFFFF', output_path='output.jpg'):
    """
    Создает изображение для Instagram Stories с текстом на цветном фоне
    
    Args:
        text: Текст для отображения
        background_color: Цвет фона в hex формате (например, '#6366f1')
        text_color: Цвет текста в hex формате (например, '#FFFFFF')
        output_path: Путь для сохранения изображения
    """
    
    # Размеры Instagram Stories (9:16)
    width = 1080
    height = 1920
    
    # Преобразуем hex цвета в RGB
    bg_rgb = hex_to_rgb(background_color)
    text_rgb = hex_to_rgb(text_color)
    
    # Создаем изображение с цветным фоном
    image = Image.new('RGB', (width, height), bg_rgb)
    draw = ImageDraw.Draw(image)
    
    # Пытаемся загрузить шрифт
    try:
        # Пробуем найти системный шрифт
        font_paths = [
            '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
            '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
            '/System/Library/Fonts/Arial.ttf',
            '/Windows/Fonts/arial.ttf'
        ]
        
        font = None
        for font_path in font_paths:
            if os.path.exists(font_path):
                try:
                    font = ImageFont.truetype(font_path, 80)
                    break
                except:
                    continue
        
        # Если не нашли системный шрифт, используем стандартный
        if font is None:
            font = ImageFont.load_default()
    except:
        font = ImageFont.load_default()
    
    # Разбиваем текст на строки для лучшего отображения
    max_chars_per_line = 20
    lines = textwrap.wrap(text, width=max_chars_per_line)
    
    # Если текст очень длинный, ограничиваем количество строк
    if len(lines) > 8:
        lines = lines[:8]
        lines[-1] += "..."
    
    # Вычисляем общую высоту текста
    line_height = 100
    total_text_height = len(lines) * line_height
    
    # Начальная позиция для центрирования по вертикали
    start_y = (height - total_text_height) // 2
    
    # Рисуем каждую строку
    for i, line in enumerate(lines):
        # Получаем размеры строки
        try:
            # Новый способ для Pillow 10+
            bbox = draw.textbbox((0, 0), line, font=font)
            line_width = bbox[2] - bbox[0]
        except AttributeError:
            # Старый способ для совместимости
            line_width, _ = draw.textsize(line, font=font)
        
        # Центрируем строку по горизонтали
        x = (width - line_width) // 2
        y = start_y + (i * line_height)
        
        # Рисуем строку
        draw.text((x, y), line, fill=text_rgb, font=font)
    
    # Сохраняем изображение
    image.save(output_path, 'JPEG', quality=95)
    
    return output_path

def main():
    """Главная функция для запуска из командной строки"""
    parser = argparse.ArgumentParser(description='Создание изображений для Instagram Stories')
    parser.add_argument('text', help='Текст для отображения на изображении')
    parser.add_argument('--bg-color', default='#6366f1', help='Цвет фона (hex, например #6366f1)')
    parser.add_argument('--text-color', default='#FFFFFF', help='Цвет текста (hex, например #FFFFFF)')
    parser.add_argument('--output', default='output.jpg', help='Путь для сохранения изображения')
    
    args = parser.parse_args()
    
    try:
        result_path = create_stories_image(
            text=args.text,
            background_color=args.bg_color,
            text_color=args.text_color,
            output_path=args.output
        )
        print(f"Изображение успешно создано: {result_path}")
        return 0
    except Exception as e:
        print(f"Ошибка создания изображения: {e}", file=sys.stderr)
        return 1

if __name__ == '__main__':
    sys.exit(main())

def main():
    parser = argparse.ArgumentParser(description='Генератор изображений для Instagram Stories')
    parser.add_argument('text', help='Текст для отображения')
    parser.add_argument('--bg-color', default='#6366f1', help='Цвет фона (hex)')
    parser.add_argument('--text-color', default='#FFFFFF', help='Цвет текста (hex)')
    parser.add_argument('--output', default='stories_image.jpg', help='Путь для сохранения')
    
    args = parser.parse_args()
    
    try:
        output_path = create_stories_image(
            args.text, 
            args.bg_color, 
            args.text_color, 
            args.output
        )
        print(f"SUCCESS:{output_path}")
    except Exception as e:
        print(f"ERROR:{str(e)}")
        sys.exit(1)

if __name__ == '__main__':
    main()