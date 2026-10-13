// Starter programs offered in the playground. scripts/run-lessons.mjs runs them all.
export const FIRST_EXAMPLE = 'andika("Habari, Dunia!")\n'

export const SAMPLES = [
  { id: 'habari', sw: 'Habari, Dunia', en: 'Hello, World', code: FIRST_EXAMPLE },
  {
    id: 'marudio',
    sw: 'Marudio na masharti',
    en: 'Loops and conditions',
    code: 'ikiwa i imo katiya(1, 7):\n    kama i % 2 == 0:\n        andika(i, "ni shufwa")\n    zaidi:\n        andika(i, "ni witiri")\n',
  },
  {
    id: 'njia',
    sw: 'Njia',
    en: 'Functions',
    code: 'njia salamu(jina):\n    rudisha "Habari, " + jina + "!"\n\nandika(salamu("Amina"))\nandika(salamu("Juma"))\n',
  },
  {
    id: 'ingiza',
    sw: 'Uliza jina',
    en: 'Ask a name',
    code: 'jina = ingiza("Jina lako ni nani? ")\nandika("Karibu,", jina)\n',
  },
  {
    id: 'kanga',
    sw: 'Chora kanga',
    en: 'Draw a kanga',
    code:
      '# Kanga kwa herufi: pindo, mji na jina\npindo = "<>" * 12\nandika(pindo)\nikiwa i imo katiya(3):\n    andika("<>" + " .  " * 5 + "<>")\nandika("<>" + "HABA NA HABA".center(20) + "<>")\nandika(pindo)\n',
  },
]
