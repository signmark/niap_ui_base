#!/usr/bin/env python3
"""
Instagram Stories публикация через instagrapi
Поддерживает все типы интерактивных элементов
"""

import json
import sys
import os
from pathlib import Path
from instagrapi import Client
from instagrapi.types import StoryMention, StoryLocation, StoryLink, StoryHashtag
from instagrapi.types import StoryPoll, StoryQuiz, StorySlider, StoryQuestion

def login_instagram(username, password):
    """Авторизация в Instagram"""
    cl = Client()
    try:
        cl.login(username, password)
        return cl
    except Exception as e:
        print(f"Ошибка авторизации: {e}")
        return None

def convert_story_elements(elements, media_width=1080, media_height=1920):
    """Конвертирует наши элементы в instagrapi формат"""
    insta_elements = []
    
    for element in elements:
        try:
            # Нормализуем координаты (0-1 для instagrapi)
            x = element['position']['x'] / 270  # Наш canvas 270px
            y = element['position']['y'] / 480  # Наш canvas 480px
            
            element_type = element['type']
            content = element.get('content', '')
            
            if element_type == 'poll':
                poll_data = json.loads(content)
                poll = StoryPoll(
                    question=poll_data['question'],
                    options=[poll_data['options'][0], poll_data['options'][1]],  # Instagram поддерживает только 2
                    x=x,
                    y=y,
                    width=0.6,  # 60% ширины экрана
                    height=0.15  # 15% высоты экрана
                )
                insta_elements.append(poll)
                
            elif element_type == 'quiz':
                quiz_data = json.loads(content)
                quiz = StoryQuiz(
                    question=quiz_data['question'],
                    options=quiz_data['options'][:4],  # До 4 вариантов
                    correct_option=quiz_data['correctAnswer'],
                    x=x,
                    y=y,
                    width=0.6,
                    height=0.2
                )
                insta_elements.append(quiz)
                
            elif element_type == 'slider':
                slider_data = json.loads(content)
                slider = StorySlider(
                    question=slider_data['question'],
                    emoji='🔥',  # Можно настроить
                    x=x,
                    y=y,
                    width=0.6,
                    height=0.1
                )
                insta_elements.append(slider)
                
            elif element_type == 'question':
                question_data = json.loads(content)
                question = StoryQuestion(
                    question=question_data.get('question', 'Задайте вопрос'),
                    x=x,
                    y=y,
                    width=0.6,
                    height=0.15
                )
                insta_elements.append(question)
                
        except Exception as e:
            print(f"Ошибка обработки элемента {element_type}: {e}")
            continue
    
    return insta_elements

def upload_story_with_elements(cl, media_path, story_elements):
    """Загружает Stories с интерактивными элементами"""
    try:
        # Загружаем Stories с интерактивными элементами
        result = cl.photo_upload_to_story(
            media_path,
            links=[],  # Внешние ссылки
            hashtags=[],  # Хештеги
            locations=[],  # Локации
            mentions=[],  # Упоминания
            polls=story_elements.get('polls', []),
            quizzes=story_elements.get('quizzes', []),
            sliders=story_elements.get('sliders', []),
            questions=story_elements.get('questions', [])
        )
        
        return {
            'success': True,
            'story_id': str(result.pk),
            'story_url': f"https://instagram.com/stories/{cl.username}/{result.pk}"
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def organize_elements_by_type(elements):
    """Группирует элементы по типам для instagrapi"""
    organized = {
        'polls': [],
        'quizzes': [],
        'sliders': [],
        'questions': []
    }
    
    for element in elements:
        if isinstance(element, StoryPoll):
            organized['polls'].append(element)
        elif isinstance(element, StoryQuiz):
            organized['quizzes'].append(element)
        elif isinstance(element, StorySlider):
            organized['sliders'].append(element)
        elif isinstance(element, StoryQuestion):
            organized['questions'].append(element)
    
    return organized

def main():
    """Основная функция для обработки Stories"""
    try:
        # Читаем данные из stdin
        input_data = json.loads(sys.stdin.read())
        
        # Извлекаем параметры
        story_data = input_data.get('storyData', {})
        credentials = input_data.get('credentials', {})
        media_path = input_data.get('mediaPath', '')
        
        username = credentials.get('username')
        password = credentials.get('password')
        
        if not username or not password:
            print(json.dumps({
                'success': False,
                'error': 'Отсутствуют учетные данные Instagram'
            }))
            return
            
        if not os.path.exists(media_path):
            print(json.dumps({
                'success': False,
                'error': f'Медиа файл не найден: {media_path}'
            }))
            return
        
        # Авторизуемся в Instagram
        cl = login_instagram(username, password)
        if not cl:
            print(json.dumps({
                'success': False,
                'error': 'Ошибка авторизации в Instagram'
            }))
            return
        
        # Обрабатываем первый слайд (Instagram Stories = один слайд)
        slides = story_data.get('slides', [])
        if not slides:
            print(json.dumps({
                'success': False,
                'error': 'Отсутствуют слайды в Stories'
            }))
            return
            
        first_slide = slides[0]
        elements = first_slide.get('elements', [])
        
        # Конвертируем элементы
        story_elements = convert_story_elements(elements)
        organized_elements = organize_elements_by_type(story_elements)
        
        # Загружаем Stories
        result = upload_story_with_elements(cl, media_path, organized_elements)
        
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f'Общая ошибка: {str(e)}'
        }))

if __name__ == '__main__':
    main()