// The single source of truth for the Pyswahili vocabulary.
//
// The Swahili -> Python table is taken from the pyswahili package by
// Jordan Kalebu (https://github.com/Kalebu/pyswahili, MIT licence; see
// PYSWAHILI-LICENSE.txt in this folder). The translator (translate.js),
// the editor highlighting, the keyword strip and the dictionary page all
// read this one list, so they cannot drift apart.
//
// kind:    'neno-kuu' = Python keyword, 'thamani' = constant, 'kazi' = built-in function or type
// meaning: what the Swahili word means in everyday use (English gloss)
export const KEYWORDS = [
  { sw: 'andika', en: 'print', kind: 'kazi', meaning: 'write' },
  { sw: 'ingiza', en: 'input', kind: 'kazi', meaning: 'put in' },
  { sw: 'kama', en: 'if', kind: 'neno-kuu', meaning: 'if' },
  { sw: 'pia', en: 'elif', kind: 'neno-kuu', meaning: 'also' },
  { sw: 'zaidi', en: 'else', kind: 'neno-kuu', meaning: 'more, besides' },
  { sw: 'ikiwa', en: 'for', kind: 'neno-kuu', meaning: 'if it be' },
  { sw: 'imo', en: 'in', kind: 'neno-kuu', meaning: 'is inside' },
  { sw: 'katiya', en: 'range', kind: 'kazi', meaning: 'between (kati ya)' },
  { sw: 'wakati', en: 'while', kind: 'neno-kuu', meaning: 'time, while' },
  { sw: 'vunja', en: 'break', kind: 'neno-kuu', meaning: 'break' },
  { sw: 'endelea', en: 'continue', kind: 'neno-kuu', meaning: 'carry on' },
  { sw: 'njia', en: 'def', kind: 'neno-kuu', meaning: 'way, path' },
  { sw: 'rudisha', en: 'return', kind: 'neno-kuu', meaning: 'give back' },
  { sw: 'jaribu', en: 'try', kind: 'neno-kuu', meaning: 'try' },
  { sw: 'ila', en: 'except', kind: 'neno-kuu', meaning: 'but, except' },
  { sw: 'Kweli', en: 'True', kind: 'thamani', meaning: 'true' },
  { sw: 'SiKweli', en: 'False', kind: 'thamani', meaning: 'not true' },
  { sw: 'tupu', en: 'None', kind: 'thamani', meaning: 'empty' },
  { sw: 'na', en: 'and', kind: 'neno-kuu', meaning: 'and' },
  { sw: 'au', en: 'or', kind: 'neno-kuu', meaning: 'or' },
  { sw: 'sio', en: 'not', kind: 'neno-kuu', meaning: 'is not' },
  { sw: 'ni', en: 'is', kind: 'neno-kuu', meaning: 'is' },
  { sw: 'darasa', en: 'class', kind: 'neno-kuu', meaning: 'classroom' },
  { sw: 'pamoja', en: 'with', kind: 'neno-kuu', meaning: 'together' },
  { sw: 'kutoka', en: 'from', kind: 'neno-kuu', meaning: 'from' },
  { sw: 'futa', en: 'del', kind: 'neno-kuu', meaning: 'erase' },
  { sw: 'neno', en: 'str', kind: 'kazi', meaning: 'word' },
  { sw: 'orodha', en: 'list', kind: 'kazi', meaning: 'list' },
  { sw: 'kamusi', en: 'dict', kind: 'kazi', meaning: 'dictionary' },
  { sw: 'seti', en: 'set', kind: 'kazi', meaning: 'set' },
  { sw: 'fungu', en: 'tuple', kind: 'kazi', meaning: 'bundle, portion' },
  { sw: 'aina', en: 'type', kind: 'kazi', meaning: 'kind, type' },
  { sw: 'niaina', en: 'isinstance', kind: 'kazi', meaning: 'is of the kind (ni aina)' },
  { sw: 'urefu', en: 'len', kind: 'kazi', meaning: 'length' },
  { sw: 'jumlisha', en: 'sum', kind: 'kazi', meaning: 'add up' },
  { sw: 'ndogo', en: 'min', kind: 'kazi', meaning: 'small' },
  { sw: 'kubwa', en: 'max', kind: 'kazi', meaning: 'big' },
  { sw: 'kamili', en: 'abs', kind: 'kazi', meaning: 'whole, complete' },
  { sw: 'karibia', en: 'round', kind: 'kazi', meaning: 'come near' },
  { sw: 'panga', en: 'sorted', kind: 'kazi', meaning: 'arrange' },
  { sw: 'kinyume', en: 'reversed', kind: 'kazi', meaning: 'the opposite' },
  { sw: 'orodhesha', en: 'enumerate', kind: 'kazi', meaning: 'list out' },
  { sw: 'unganisha', en: 'zip', kind: 'kazi', meaning: 'join together' },
  { sw: 'badilisha', en: 'map', kind: 'kazi', meaning: 'change' },
  { sw: 'chuja', en: 'filter', kind: 'kazi', meaning: 'sieve' },
  { sw: 'yoyote', en: 'any', kind: 'kazi', meaning: 'any' },
  { sw: 'yote', en: 'all', kind: 'kazi', meaning: 'all' },
]

export const SW_TO_EN = Object.freeze(Object.fromEntries(KEYWORDS.map((k) => [k.sw, k.en])))
export const EN_TO_SW = Object.freeze(Object.fromEntries(KEYWORDS.map((k) => [k.en, k.sw])))
export const KIND_OF = Object.freeze(Object.fromEntries(KEYWORDS.map((k) => [k.sw, k.kind])))

// Python's own keywords and common built-ins stay valid (Pyswahili only renames),
// so the editor highlights them too.
export const PY_KEYWORDS = new Set(
  'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield'.split(' '),
)
export const PY_BUILTINS = new Set(
  'print input range len int float str list dict set tuple bool type isinstance min max sum abs round sorted reversed enumerate zip map filter any all'.split(' '),
)
