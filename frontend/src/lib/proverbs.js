// Jina: the proverb line printed on a kanga. These are long-established
// Swahili methali; the English lines are plain glosses, not literary translations.
export const PROVERBS = {
  uwanja: ['Haraka haraka haina baraka.', 'Hurry, hurry has no blessing.'],
  mazoezi: ['Elimu haina mwisho.', 'Learning has no end.'],
  kamusi: ['Kuuliza si ujinga.', 'To ask is not ignorance.'],
  utangulizi: ['Haba na haba hujaza kibaba.', 'Little by little fills the measure.'],
  sintaksia: ['Usipoziba ufa utajenga ukuta.', 'If you do not fill the crack, you will build the wall.'],
  maoni: ['Asiyesikia la mkuu huvunjika guu.', 'One who ignores an elder’s word breaks a leg.'],
  vigezo: ['Akiba haiozi.', 'What is saved does not rot.'],
  'aina-za-data': ['Kila ndege huruka kwa ubawa wake.', 'Every bird flies with its own wing.'],
  namba: ['Bandu bandu huisha gogo.', 'Chip by chip, the log is finished.'],
  'ubadilishaji-aina': ['Samaki mkunje angali mbichi.', 'Bend the fish while it is still fresh.'],
  maandishi: ['Kidole kimoja hakivunji chawa.', 'One finger cannot crush a louse.'],
  'kweli-na-sikweli': ['Njia ya mwongo ni fupi.', 'The liar’s road is short.'],
  waendeshaji: ['Mchagua jembe si mkulima.', 'One who is fussy about the hoe is no farmer.'],
  orodha: ['Umoja ni nguvu, utengano ni udhaifu.', 'Unity is strength, division is weakness.'],
  tuple: ['Mwacha mila ni mtumwa.', 'One who abandons their customs is a slave.'],
  seti: ['Mchele mmoja, mapishi mengi.', 'One rice, many ways of cooking it.'],
  'somo:kamusi': ['Mtaka cha mvunguni sharti ainame.', 'Whoever wants what is under the bed must stoop.'],
  'masharti-kama-zaidi': ['Njia mbili zilimshinda fisi.', 'Two roads were too much for the hyena.'],
  'marudio-wakati': ['Papo kwa papo kamba hukata jiwe.', 'Bit by bit, the rope cuts the stone.'],
  'marudio-ikiwa': ['Polepole ndio mwendo.', 'Slowly is the way to go.'],
  njia: ['Mkono mmoja haulei mwana.', 'One hand does not raise a child.'],
  'jaribu-ila': ['Kuteleza si kuanguka.', 'To slip is not to fall.'],
  'kazi-za-msingi': ['Usione vyaelea, vijue vimeundwa.', 'When you see vessels afloat, know that someone built them.'],
}

// The lesson with id "kamusi" (dictionaries) would collide with the dictionary page.
export function proverbFor(view, lessonId) {
  if (view === 'masomo' && lessonId) {
    return PROVERBS[lessonId === 'kamusi' ? 'somo:kamusi' : lessonId] || PROVERBS.uwanja
  }
  return PROVERBS[view] || PROVERBS.uwanja
}
