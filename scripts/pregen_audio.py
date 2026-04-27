"""
Pre-generate TTS audio for all lessons in English and Swahili.

Default behavior is incremental: only missing lesson audio files are generated.
Use --refresh-all to force full regeneration of every lesson audio file.

Run from the repo root:
    python scripts/pregen_audio.py

Or from the backend directory:
    python ../scripts/pregen_audio.py
"""
from __future__ import annotations

import argparse
import re
import sys
import time
import json
import subprocess
import importlib
import hashlib
import shutil
from pathlib import Path

# Make sure backend/ is on the path regardless of where the script is called from.
BACKEND_DIR = Path(__file__).resolve().parents[1] / 'backend'
sys.path.insert(0, str(BACKEND_DIR))

# Change working directory so pydantic-settings can find backend/.env
import os
os.chdir(BACKEND_DIR)

# Resolve backend import at runtime after adjusting sys.path/cwd for this script.
synthesize_speech = importlib.import_module('app.services.tts_service').synthesize_speech

AUDIO_DIR = BACKEND_DIR / 'audio'
LESSON_AUDIO_PREFIX = 'lesson-'
LESSON_MANIFEST_PATH = AUDIO_DIR / 'lessons_manifest.json'

# ---------------------------------------------------------------------------
# Lesson data (mirrors frontend/src/data/lessons.js)
# ---------------------------------------------------------------------------
LESSONS = [
    {
        'id': 'utangulizi', 'order': 1,
        'titleEn': 'Introduction', 'titleSw': 'Utangulizi',
        'summaryEn': 'Start by printing simple messages and seeing program output clearly.',
        'summarySw': 'Anza kwa kuchapisha ujumbe rahisi na kuona tokeo la programu wazi.',
        'example': {'titleEn': 'First Output', 'titleSw': 'Tokeo la Kwanza'},
        'test': {
            'promptEn': 'Print the text: Welcome to class',
            'promptSw': 'Chapisha maandishi: Karibu darasani',
        },
    },
    {
        'id': 'sintaksia', 'order': 2,
        'titleEn': 'Syntax', 'titleSw': 'Sintaksia',
        'summaryEn': 'Learn line structure and indentation inside code blocks.',
        'summarySw': 'Jifunze mpangilio wa mistari na nafasi za ndani kwenye vifungu vya msimbo.',
        'example': {'titleEn': 'Indented Block', 'titleSw': 'Block Yenye Nafasi'},
        'test': {
            'promptEn': 'Write code that prints yes when 2 is less than 3.',
            'promptSw': 'Andika msimbo unaochapisha ndio kama 2 ni ndogo kuliko 3.',
        },
    },
    {
        'id': 'maoni', 'order': 3,
        'titleEn': 'Comments', 'titleSw': 'Maoni',
        'summaryEn': 'Use comments to explain intent without executing those lines.',
        'summarySw': 'Tumia maoni kueleza kusudi bila kuendesha mistari hiyo.',
        'example': {'titleEn': 'Single Comment', 'titleSw': 'Maoni ya Mstari'},
        'test': {
            'promptEn': 'Write one comment line and then print Hi.',
            'promptSw': 'Andika maoni moja kisha uchapishe Hi.',
        },
    },
    {
        'id': 'vigezo', 'order': 4,
        'titleEn': 'Variables', 'titleSw': 'Vigezo',
        'summaryEn': 'Store values in named variables and reuse them later.',
        'summarySw': 'Hifadhi thamani kwenye vigezo vyenye majina na vitumie tena baadaye.',
        'example': {'titleEn': 'Simple Variable', 'titleSw': 'Kigezo Rahisi'},
        'test': {
            'promptEn': 'Create variable age with 12 and print it.',
            'promptSw': 'Tengeneza kigezo umri chenye 12 kisha kichapishe.',
        },
    },
    {
        'id': 'aina-za-data', 'order': 5,
        'titleEn': 'Data Types', 'titleSw': 'Aina za Data',
        'summaryEn': 'Understand text, numbers, booleans, and basic collections.',
        'summarySw': 'Elewa maandishi, namba, Kweli/SiKweli, na makusanyiko ya msingi.',
        'example': {'titleEn': 'Mixed Types', 'titleSw': 'Mchanganyiko wa Aina'},
        'test': {
            'promptEn': 'Create variable word = "code" and print it.',
            'promptSw': 'Tengeneza kigezo neno = "code" kisha ukichapishe.',
        },
    },
    {
        'id': 'namba', 'order': 6,
        'titleEn': 'Numbers', 'titleSw': 'Namba',
        'summaryEn': 'Use integers and decimals in arithmetic operations.',
        'summarySw': 'Tumia namba kamili na desimali kwenye mahesabu.',
        'example': {'titleEn': 'Addition', 'titleSw': 'Jumla ya Namba'},
        'test': {
            'promptEn': 'Print the result of 8 + 4.',
            'promptSw': 'Chapisha matokeo ya 8 kuongeza 4.',
        },
    },
    {
        'id': 'ubadilishaji-aina', 'order': 7,
        'titleEn': 'Type Casting', 'titleSw': 'Ubadilishaji wa Aina',
        'summaryEn': 'Convert values between str, int, and float types.',
        'summarySw': 'Badilisha thamani kati ya neno (str), int, na float.',
        'example': {'titleEn': 'Text to Number', 'titleSw': 'Maandishi kuwa Namba'},
        'test': {
            'promptEn': 'Convert "9" to int and print it.',
            'promptSw': 'Badilisha "9" kuwa int na uchapishe.',
        },
    },
    {
        'id': 'maandishi', 'order': 8,
        'titleEn': 'Strings', 'titleSw': 'Maandishi',
        'summaryEn': 'Work with text values and combine strings safely.',
        'summarySw': 'Fanya kazi na maandishi na yaunganishe kwa usahihi.',
        'example': {'titleEn': 'Join Text', 'titleSw': 'Kuunganisha Maandishi'},
        'test': {
            'promptEn': 'Create word = "Jambo" and print it.',
            'promptSw': 'Tengeneza neno = "Jambo" kisha lichapishe.',
        },
    },
    {
        'id': 'kweli-na-sikweli', 'order': 9,
        'titleEn': 'Booleans', 'titleSw': 'Kweli na SiKweli',
        'summaryEn': 'Use true/false logic for conditions and decisions.',
        'summarySw': 'Tumia mantiki ya kweli/sikweli kwa masharti na maamuzi.',
        'example': {'titleEn': 'Boolean Check', 'titleSw': 'Ukaguzi wa Kweli'},
        'test': {
            'promptEn': 'Print the result of 3 == 3.',
            'promptSw': 'Chapisha matokeo ya 3 == 3.',
        },
    },
    {
        'id': 'waendeshaji', 'order': 10,
        'titleEn': 'Operators', 'titleSw': 'Waendeshaji',
        'summaryEn': 'Compare and combine values with operator symbols.',
        'summarySw': 'Linganisha na changanya thamani kwa alama za waendeshaji.',
        'example': {'titleEn': 'Comparison', 'titleSw': 'Ulinganisho'},
        'test': {
            'promptEn': 'Print whether 4 is not equal to 7.',
            'promptSw': 'Chapisha kama 4 sio sawa na 7.',
        },
    },
    {
        'id': 'orodha', 'order': 11,
        'titleEn': 'Lists', 'titleSw': 'Orodha',
        'summaryEn': 'Store multiple ordered values in one variable.',
        'summarySw': 'Hifadhi thamani nyingi zenye mpangilio kwenye kigezo kimoja.',
        'example': {'titleEn': 'List Item Access', 'titleSw': 'Kipengele cha Orodha'},
        'test': {
            'promptEn': 'Create ["red", "blue"] and print the first item.',
            'promptSw': 'Tengeneza ["red", "blue"] kisha chapisha kipengele cha kwanza.',
        },
    },
    {
        'id': 'tuple', 'order': 12,
        'titleEn': 'Tuples', 'titleSw': 'Tuple',
        'summaryEn': 'Use tuples for fixed ordered data.',
        'summarySw': 'Tumia tuple kwa data yenye mpangilio wa kudumu.',
        'example': {'titleEn': 'Tuple Item Access', 'titleSw': 'Kipengele cha Tuple'},
        'test': {
            'promptEn': 'Create (1, 2) and print the second value.',
            'promptSw': 'Tengeneza (1, 2) na uchapishe thamani ya pili.',
        },
    },
    {
        'id': 'seti', 'order': 13,
        'titleEn': 'Sets', 'titleSw': 'Seti',
        'summaryEn': 'Use sets for unique values without duplicates.',
        'summarySw': 'Tumia seti kwa thamani za kipekee zisizo na marudio.',
        'example': {'titleEn': 'Unique Values', 'titleSw': 'Thamani za Kipekee'},
        'test': {
            'promptEn': 'Create set {1, 2, 2} and print it.',
            'promptSw': 'Tengeneza seti {1, 2, 2} na uichapishe.',
        },
    },
    {
        'id': 'kamusi', 'order': 14,
        'titleEn': 'Dictionaries', 'titleSw': 'Kamusi',
        'summaryEn': 'Store key-value pairs and access values by key.',
        'summarySw': 'Hifadhi jozi za ufunguo-thamani na pata thamani kwa ufunguo.',
        'example': {'titleEn': 'Dictionary Value', 'titleSw': 'Thamani Kutoka Kamusi'},
        'test': {
            'promptEn': 'Create {"name": "Ali"} and print name.',
            'promptSw': 'Tengeneza {"jina": "Ali"} kisha chapisha jina.',
        },
    },
    {
        'id': 'masharti-kama-zaidi', 'order': 15,
        'titleEn': 'Conditions: if ... else', 'titleSw': 'Masharti: kama ... zaidi',
        'summaryEn': 'Choose different paths based on a condition.',
        'summarySw': 'Chagua njia tofauti za utekelezaji kulingana na sharti.',
        'example': {'titleEn': 'Simple Decision', 'titleSw': 'Uamuzi Rahisi'},
        'test': {
            'promptEn': 'Print go when x is 1, otherwise print stop.',
            'promptSw': 'Chapisha go wakati x ni 1, la sivyo chapisha stop.',
        },
    },
    {
        'id': 'marudio-wakati', 'order': 16,
        'titleEn': 'Loops: while', 'titleSw': 'Marudio: wakati',
        'summaryEn': 'Repeat a block while a condition remains true.',
        'summarySw': 'Rudia kifungu cha msimbo wakati sharti ni kweli, na simama sharti linapokuwa si kweli.',
        'example': {'titleEn': 'While Counting', 'titleSw': 'Kuhesabu kwa wakati'},
        'test': {
            'promptEn': 'Use while to print 1 and 2.',
            'promptSw': 'Tumia wakati kuchapisha 1 na 2.',
        },
    },
    {
        'id': 'marudio-ikiwa', 'order': 17,
        'titleEn': 'Loops: for', 'titleSw': 'Marudio: ikiwa',
        'summaryEn': 'Iterate over a list or range using for loops.',
        'summarySw': 'Pitia orodha au range kwa kutumia marudio ya ikiwa.',
        'example': {'titleEn': 'Loop Through List', 'titleSw': 'Pitia Orodha'},
        'test': {
            'promptEn': 'Use for range(3) to print 0, 1, 2.',
            'promptSw': 'Tumia ikiwa katiya(3) kuchapisha 0, 1, 2.',
        },
    },
    {
        'id': 'njia', 'order': 18,
        'titleEn': 'Functions', 'titleSw': 'Njia',
        'summaryEn': 'Group reusable logic into functions.',
        'summarySw': 'Kusanya mantiki inayotumika tena ndani ya njia.',
        'example': {'titleEn': 'Greeting Function', 'titleSw': 'Njia ya Salamu'},
        'test': {
            'promptEn': 'Create a function show that prints ok.',
            'promptSw': 'Tengeneza njia inayoitwa onesha inayochapisha ok.',
        },
    },
    {
        'id': 'jaribu-ila', 'order': 19,
        'titleEn': 'Try ... Except', 'titleSw': 'Jaribu ... Ila',
        'summaryEn': 'Handle common runtime errors with try/except.',
        'summarySw': 'Shughulikia makosa ya kawaida ya runtime kwa jaribu/ila.',
        'example': {'titleEn': 'Catch Error', 'titleSw': 'Kushika Kosa'},
        'test': {
            'promptEn': 'Write try/except that prints error when x is missing.',
            'promptSw': 'Andika jaribu/ila inayochapisha kosa wakati x haipo.',
        },
    },
    {
        'id': 'kazi-za-msingi', 'order': 20,
        'titleEn': 'Built-in Functions in Pyswahili', 'titleSw': 'Kazi za Msingi za Pyswahili',
        'summaryEn': 'Use Swahili names for common Python built-ins like min, max, sum, and len.',
        'summarySw': 'Tumia majina ya Kiswahili kwa built-ins za Python kama min, max, sum, na len.',
        'example': {'titleEn': 'Common Built-ins', 'titleSw': 'Built-ins za Kawaida'},
        'test': {
            'promptEn': 'Given nums = [5, 2, 8], print the minimum then the maximum value.',
            'promptSw': 'Ukipewa nums = [5, 2, 8], chapisha ndogo zaidi kisha kubwa zaidi.',
        },
    },
]

LESSON_EXPLANATIONS: dict[str, dict[str, list[str]]] = {
    'utangulizi': {
        'en': ['This lesson introduces output. You write a line and immediately see what the program prints.',
               'That quick feedback loop is the foundation of learning to code.'],
        'sw': ['Somo hili linaanzisha tokeo. Unaandika mstari mmoja na unaona programu inachapisha nini mara moja.',
               'Mzunguko huu wa majibu ya haraka ndio msingi wa kujifunza kuandika msimbo.'],
    },
    'sintaksia': {
        'en': ['Syntax is the set of rules for writing valid code.',
               'Indentation inside code blocks controls which lines belong together.'],
        'sw': ['Sintaksia ni seti ya sheria za kuandika msimbo sahihi.',
               'Nafasi za ndani kwenye vifungu vya msimbo huamua ni mistari gani iko pamoja.'],
    },
    'maoni': {
        'en': ['Comments are for humans and documentation, not for execution.',
               'Use comments to explain intent and make code easier to maintain.'],
        'sw': ['Maoni ni kwa wasomaji na nyaraka, si kwa uendeshaji wa programu.',
               'Tumia maoni kueleza kusudi na kufanya msimbo uwe rahisi kutunza.'],
    },
    'vigezo': {
        'en': ['Variables store values under clear names.',
               'Good variable names improve readability and reduce mistakes.'],
        'sw': ['Vigezo huhifadhi thamani chini ya majina yaliyo wazi.',
               'Majina mazuri ya vigezo huongeza uelewevu na kupunguza makosa.'],
    },
    'aina-za-data': {
        'en': ['Data types describe what a value is: text, number, boolean, or collection.',
               'Knowing types helps you choose the correct operations.'],
        'sw': ['Aina za data huonyesha thamani ni nini: maandishi, namba, boolean au mkusanyiko.',
               'Kujua aina hukusaidia kuchagua operesheni sahihi.'],
    },
    'namba': {
        'en': ['Numbers are used in arithmetic and comparisons.',
               'You can combine integers and decimals depending on your task.'],
        'sw': ['Namba hutumika kwenye mahesabu na ulinganisho.',
               'Unaweza kuchanganya namba kamili na desimali kulingana na kazi yako.'],
    },
    'ubadilishaji-aina': {
        'en': ['Type casting converts values from one data type to another.',
               'This is useful when a numeric value starts as text.'],
        'sw': ['Casting hubadilisha thamani kutoka aina moja hadi nyingine.',
               'Hii husaidia wakati thamani ya namba inaanza kama maandishi.'],
    },
    'maandishi': {
        'en': ['Strings represent text and are useful for messages and labels.',
               'You can join strings with + to build longer output text.'],
        'sw': ['Strings huwakilisha maandishi na hufaa kwa ujumbe na lebo.',
               'Unaweza kuunganisha strings kwa + kutengeneza maandishi marefu ya tokeo.'],
    },
    'kweli-na-sikweli': {
        'en': ['Boolean values are True or False.',
               'They are central to conditions and control flow.'],
        'sw': ['Thamani za boolean ni Kweli au SiKweli.',
               'Ndizo msingi wa masharti na mtiririko wa maamuzi.'],
    },
    'waendeshaji': {
        'en': ['Operators perform actions like add, compare, and combine logic.',
               'Mastering operators helps you write compact, clear code.'],
        'sw': ['Waendeshaji hufanya kazi kama kuongeza, kulinganisha na kuunganisha mantiki.',
               'Ukizimudu, utaandika msimbo mfupi na wazi.'],
    },
    'orodha': {
        'en': ['Lists store ordered items in a single variable.',
               'Use indexes to access specific list items.'],
        'sw': ['Orodha huhifadhi vipengele vyenye mpangilio ndani ya kigezo kimoja.',
               'Tumia index kupata kipengele maalum cha orodha.'],
    },
    'tuple': {
        'en': ['Tuples are ordered collections used for fixed groups of values.',
               'They are useful when structure should stay stable.'],
        'sw': ['Tuple ni mkusanyiko wenye mpangilio unaotumika kwa vikundi vya kudumu vya thamani.',
               'Hufaa pale muundo unapotakiwa kubaki thabiti.'],
    },
    'seti': {
        'en': ['Sets keep unique values and automatically remove duplicates.',
               'They are useful for deduplication tasks.'],
        'sw': ['Seti hubakiza thamani za kipekee na kuondoa marudio moja kwa moja.',
               'Hufaa kwa kazi za kuondoa marudio kwenye data.'],
    },
    'kamusi': {
        'en': ['Dictionaries map keys to values.',
               'They are ideal for structured records.'],
        'sw': ['Kamusi huunganisha ufunguo na thamani.',
               'Ni bora kwa rekodi zenye muundo.'],
    },
    'masharti-kama-zaidi': {
        'en': ['Conditionals choose one path or another based on a rule.',
               'if/else is a core tool for decision-making.'],
        'sw': ['Masharti huchagua njia moja au nyingine kulingana na kanuni.',
               'kama/zaidi ni zana ya msingi ya kufanya maamuzi.'],
    },
    'marudio-wakati': {
        'en': ['while loops repeat until a condition becomes false.',
               'Make sure loop variables change to avoid infinite loops.'],
         'sw': ['wakati hurudia hadi sharti liwe si kweli.',
               'Hakikisha kigezo kinabadilika ili kuepuka loop isiyoisha.'],
    },
    'marudio-ikiwa': {
        'en': ['for loops iterate through collections or ranges.',
               'They are ideal when you know what sequence to traverse.'],
        'sw': ['ikiwa hupitia makusanyiko au range.',
               'Ni bora unapojua mfuatano unaotaka kupitia.'],
    },
    'njia': {
        'en': ['Functions package reusable logic under one name.',
               'They reduce repetition and improve code structure.'],
        'sw': ['Njia hukusanya mantiki inayotumika tena chini ya jina moja.',
               'Hupunguza kurudia msimbo na kuboresha muundo wa programu.'],
    },
    'jaribu-ila': {
        'en': ['try/except handles runtime errors gracefully.',
               'Use it when a line may fail and you want controlled behavior.'],
        'sw': ['jaribu/ila hushughulikia makosa ya runtime kwa utulivu.',
               'Tumia pale mstari unaweza kushindwa na unataka tabia iliyodhibitiwa.'],
    },
        'kazi-za-msingi': {
         'en': ['Built-in functions are ready-made Python tools for common tasks.',
             'In Pyswahili use ndogo, kubwa, jumlisha, and urefu for compact code.'],
         'sw': ['Built-ins ni zana zilizopo tayari ndani ya Python kwa kazi za kawaida.',
             'Kwenye Pyswahili tumia ndogo, kubwa, jumlisha, na urefu ili msimbo uwe mfupi na wazi.'],
        },
}


def _load_frontend_lessons() -> tuple[list[dict], dict[str, dict[str, list[str]]]]:
    """Load lessons and explanations from frontend/src/data/lessons.js via Node.

    Falls back to in-file defaults if Node or import fails.
    """
    frontend_lessons_path = Path(__file__).resolve().parents[1] / 'frontend' / 'src' / 'data' / 'lessons.js'
    if not frontend_lessons_path.exists():
        return LESSONS, LESSON_EXPLANATIONS

    node_script = (
        "const p = process.argv[1];"
        "import('url').then(({ pathToFileURL }) => "
        "import(pathToFileURL(p).href)).then((m) => "
        "console.log(JSON.stringify({ lessons: m.lessons, lessonExplanations: m.lessonExplanations })));"
    )

    try:
        result = subprocess.run(
            ['node', '-e', node_script, str(frontend_lessons_path)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
            text=True,
            encoding='utf-8',
        )
        parsed = json.loads(result.stdout)
        loaded_lessons = parsed.get('lessons') or LESSONS
        loaded_explanations = parsed.get('lessonExplanations') or LESSON_EXPLANATIONS
        return loaded_lessons, loaded_explanations
    except Exception:
        return LESSONS, LESSON_EXPLANATIONS


# ---------------------------------------------------------------------------
# Mirrors frontend formatLessonTitle and buildLessonNarration
# ---------------------------------------------------------------------------
def format_lesson_title(title: str) -> str:
    return re.sub(r'\s{2,}', ' ', re.sub(r'\bPython\b\s*', '', title, flags=re.IGNORECASE)).strip()


def verbalize_symbols_for_audio(text: str, lang: str) -> str:
    source = text or ''
    replacements = [
        ('>=', 'kubwa au sawa na' if lang == 'sw' else 'greater than or equal to'),
        ('<=', 'ndogo au sawa na' if lang == 'sw' else 'less than or equal to'),
        ('==', 'sawa na sawa na' if lang == 'sw' else 'is equal to'),
        ('!=', 'sio sawa na' if lang == 'sw' else 'is not equal to'),
        ('->', 'inaelekea kwa' if lang == 'sw' else 'maps to'),
        ('+', 'jumlisha' if lang == 'sw' else 'plus'),
        ('-', 'toa' if lang == 'sw' else 'minus'),
        ('*', 'zidisha' if lang == 'sw' else 'times'),
        ('/', 'gawa kwa' if lang == 'sw' else 'divided by'),
        (':', 'koloni' if lang == 'sw' else 'colon'),
        ('#', 'alama ya namba' if lang == 'sw' else 'hash'),
        ('(', 'fungua mabano' if lang == 'sw' else 'open parenthesis'),
        (')', 'funga mabano' if lang == 'sw' else 'close parenthesis'),
        ('[', 'fungua mabano ya mraba' if lang == 'sw' else 'open bracket'),
        (']', 'funga mabano ya mraba' if lang == 'sw' else 'close bracket'),
        ('{', 'fungua mabano ya curly' if lang == 'sw' else 'open brace'),
        ('}', 'funga mabano ya curly' if lang == 'sw' else 'close brace'),
    ]

    spoken = source
    for symbol, word in replacements:
        spoken = spoken.replace(symbol, f' {word} ')
    return re.sub(r'\s{2,}', ' ', spoken).strip()


def build_lesson_narration(lesson: dict, lang: str, lesson_explanations: dict[str, dict[str, list[str]]]) -> str:
    concepts = lesson_explanations[lesson['id']][lang]
    raw_summary = lesson['summarySw'] if lang == 'sw' else lesson['summaryEn']
    raw_concept_lead = concepts[0] if concepts else raw_summary
    raw_concept_follow = concepts[1] if len(concepts) > 1 else raw_concept_lead

    summary = verbalize_symbols_for_audio(raw_summary, lang)
    concept_lead = verbalize_symbols_for_audio(raw_concept_lead, lang)
    concept_follow = verbalize_symbols_for_audio(raw_concept_follow, lang)
    test_prompt = verbalize_symbols_for_audio(lesson['test']['promptSw'] if lang == 'sw' else lesson['test']['promptEn'], lang)

    if lang == 'sw':
        lesson_title = format_lesson_title(lesson['titleSw'])
        return ' '.join([
            f"Karibu kwenye somo la {lesson['order']}, {lesson_title}.",
            f"Leo tutajifunza mada hii: {summary}",
            f"Wazo la kwanza la kushika ni hili: {concept_lead}",
            f"Baada ya hapo, kumbuka pia kwamba {concept_follow}",
            f"Ukihitaji mazoezi, fungua mfano wa {lesson['example']['titleSw']} na ubadilishe mistari michache kwa makusudi.",
            f"Mwisho wa somo, changamoto yako ni hii: {test_prompt}",
            'Jaribu polepole, angalia matokeo, na chukulia kila tokeo kama mrejesho wa kujifunza kwa vitendo.',
        ])

    lesson_title = format_lesson_title(lesson['titleEn'])
    return ' '.join([
        f"Welcome to lesson {lesson['order']}, {lesson_title}.",
        f"Today we are going to learn this topic: {summary}",
        f"The first idea I want you to hold onto is this: {concept_lead}",
        f"After that, keep this second point in view: {concept_follow}",
        f"If you want a quick practice round, open the example called {lesson['example']['titleEn']} and intentionally tweak a few lines.",
        f"At the end of the lesson, your challenge is: {test_prompt}",
        'Go step by step, watch the output carefully, and treat each result as practical feedback you can learn from.',
    ])


def _compute_tts_cache_hash(text: str, lang: str) -> str:
    """Mirror app.services.tts_service cache key generation exactly."""
    cleaned_text = ' '.join(text.split())
    return hashlib.sha256(f'{lang}:{cleaned_text}'.encode('utf-8')).hexdigest()


def _lesson_audio_filename(lesson: dict, lang: str) -> str:
    return f"lesson-{lesson['order']:02d}_{lesson['id']}_{lang}.wav"


def _remove_previous_lesson_audio_files() -> None:
    """Clear prior lesson-labeled files to avoid stale duplicates after content changes."""
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    for wav_file in AUDIO_DIR.glob(f'{LESSON_AUDIO_PREFIX}*.wav'):
        wav_file.unlink(missing_ok=True)


def _materialize_lesson_audio_from_cache(cache_hash: str, lesson_filename: str) -> Path:
    """Copy synthesized cache file to lesson-friendly filename and return destination path."""
    source = AUDIO_DIR / f'{cache_hash}.wav'
    destination = AUDIO_DIR / lesson_filename
    if not source.exists():
        raise FileNotFoundError(f'Expected cache file missing: {source.name}')
    shutil.copy2(source, destination)
    return destination


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(description='Pre-generate lesson narration audio files.')
    parser.add_argument(
        '--refresh-all',
        action='store_true',
        help='Regenerate all lesson audio files, replacing existing lesson-* files.',
    )
    args = parser.parse_args()

    loaded_lessons, loaded_explanations = _load_frontend_lessons()
    if args.refresh_all:
        _remove_previous_lesson_audio_files()

    total = len(loaded_lessons) * 2
    done = 0
    generated = 0
    skipped = 0
    total_bytes = 0
    errors: list[str] = []
    lesson_manifest: dict[str, dict[str, dict[str, str | int]]] = {}

    mode_label = 'full refresh' if args.refresh_all else 'incremental (missing files only)'
    print(f'Pre-generating audio for {len(loaded_lessons)} lessons × 2 languages = {total} files ({mode_label})\n')

    for lesson in loaded_lessons:
        for lang in ('en', 'sw'):
            narration = build_lesson_narration(lesson, lang, loaded_explanations)
            label = f"[{done + 1:02d}/{total}] lesson={lesson['id']} lang={lang}"
            lesson_filename = _lesson_audio_filename(lesson, lang)
            lesson_path = AUDIO_DIR / lesson_filename
            cache_hash = _compute_tts_cache_hash(narration, lang)

            if not args.refresh_all and lesson_path.exists():
                file_size = lesson_path.stat().st_size
                lesson_manifest.setdefault(lesson['id'], {})[lang] = {
                    'filename': lesson_path.name,
                    'cache_hash': cache_hash,
                    'bytes': file_size,
                    'relative_path': f'audio/{lesson_path.name}',
                }
                total_bytes += file_size
                skipped += 1
                print(f"  SKIP {label}  {lesson_path.name}  already exists")
                done += 1
                continue

            try:
                t0 = time.monotonic()
                data = synthesize_speech(narration, lang)
                lesson_path = _materialize_lesson_audio_from_cache(cache_hash, lesson_filename)
                elapsed = time.monotonic() - t0
                total_bytes += len(data)
                generated += 1
                lesson_manifest.setdefault(lesson['id'], {})[lang] = {
                    'filename': lesson_path.name,
                    'cache_hash': cache_hash,
                    'bytes': len(data),
                    'relative_path': f'audio/{lesson_path.name}',
                }
                print(f"  OK  {label}  {lesson_path.name}  {len(data) // 1024}KB  ({elapsed:.1f}s)")
            except Exception as exc:
                errors.append(f"{label}: {exc}")
                print(f"  ERR {label}: {exc}")
            done += 1

    LESSON_MANIFEST_PATH.write_text(
        json.dumps(
            {
                'generated_at_epoch': int(time.time()),
                'lessons_count': len(loaded_lessons),
                'languages': ['en', 'sw'],
                'files': lesson_manifest,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding='utf-8',
    )

    print(f'\nDone. {done - len(errors)}/{total} succeeded.')
    print(f'Generated: {generated} | Skipped existing: {skipped} | Failed: {len(errors)}')
    print(f'Total cached audio: {total_bytes / (1024 * 1024):.1f} MB')
    print(f'Lesson manifest: {LESSON_MANIFEST_PATH}')
    if errors:
        print('\nFailed:')
        for e in errors:
            print(f'  {e}')


if __name__ == '__main__':
    main()
