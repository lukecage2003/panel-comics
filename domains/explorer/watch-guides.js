'use strict';
// Dossiers « Avant de voir » (D-75) : pour les grandes sorties ciné et séries tirées des comics, ce qu'il faut voir
// et lire avant. Données éditoriales de Panel (titres et années vérifiables), sans résumé recopié.
//  - Un dossier s'affiche quand l'actualité en parle (mots-clés dans les articles récents) ou quand sa sortie approche.
//  - Les dates sont celles annoncées publiquement ; elles peuvent changer (le libellé le dit).
//  - « read[].q » est la recherche lancée dans l'Explorer (base Comic Vine) pour trouver l'édition.

const GUIDES = Object.freeze([
  {
    id: 'avengers-doomsday', title: 'Avengers: Doomsday', studio: 'Marvel Studios', kind: 'film', release: '2026-12-16', releaseLabel: 'au cinéma le 16 décembre 2026 (France, date annoncée)',
    match: /avengers:? doomsday|doomsday/i, hero: 'Docteur Fatalis (Victor von Doom)',
    watch: [
      { t: 'Avengers: Endgame', y: 2019, why: 'la fin de la Saga de l\'Infini et le point de départ des nouveaux Avengers' },
      { t: 'Loki, saison 2', y: 2023, why: 'le multivers, le Temps et les variants (Disney+)' },
      { t: 'Deadpool & Wolverine', y: 2024, why: 'le Vide et le retour des héros de l\'ère Fox' },
      { t: 'Captain America: Brave New World', y: 2025, why: 'Sam Wilson en Captain America' },
      { t: 'Thunderbolts*', y: 2025, why: 'la nouvelle équipe qui se fait appeler « New Avengers »' },
      { t: 'Les 4 Fantastiques : Premiers pas', y: 2025, why: 'la famille Richards, liée à Fatalis depuis 1962' },
      { t: 'X-Men et X-Men 2', y: 2000, why: 'les mutants de la Fox, annoncés au casting' }
    ],
    read: [
      { t: 'Books of Doom', y: 2005, by: 'Ed Brubaker, Pablo Raimondi', why: 'les origines de Victor von Doom', q: 'Books of Doom' },
      { t: 'Fantastic Four : Unthinkable', y: 2003, by: 'Mark Waid, Mike Wieringo', why: 'Fatalis au sommet de sa cruauté', q: 'Fantastic Four Unthinkable' },
      { t: 'Avengers / New Avengers (Hickman)', y: 2012, by: 'Jonathan Hickman', why: 'les incursions qui mènent à Secret Wars', q: 'New Avengers Hickman' },
      { t: 'Secret Wars', y: 2015, by: 'Jonathan Hickman, Esad Ribić', why: 'Doom devenu dieu-empereur de Battleworld', q: 'Secret Wars 2015' },
      { t: 'Infamous Iron Man', y: 2016, by: 'Brian Michael Bendis, Alex Maleev', why: 'Fatalis veut se racheter', q: 'Infamous Iron Man' },
      { t: 'One World Under Doom', y: 2025, by: 'Ryan North, R.B. Silva', why: 'Doom, Sorcier suprême, prend le pouvoir sur Terre', q: 'One World Under Doom' }
    ]
  },
  {
    id: 'avengers-secret-wars', title: 'Avengers: Secret Wars', studio: 'Marvel Studios', kind: 'film', release: '2027-12-15', releaseLabel: 'au cinéma en décembre 2027 (date annoncée)',
    match: /avengers:? secret wars|secret wars/i, hero: 'le multivers Marvel',
    watch: [
      { t: 'Avengers: Doomsday', y: 2026, why: 'la première partie' },
      { t: 'Loki, saisons 1 et 2', y: 2021, why: 'la naissance du multivers' },
      { t: 'Doctor Strange in the Multiverse of Madness', y: 2022, why: 'les incursions entre univers' },
      { t: 'Spider-Man: No Way Home', y: 2021, why: 'les Spider-Man d\'autres univers' }
    ],
    read: [
      { t: 'Secret Wars (1984)', y: 1984, by: 'Jim Shooter, Mike Zeck', why: 'le Beyonder et le premier Battleworld', q: 'Secret Wars 1984' },
      { t: 'Secret Wars (2015)', y: 2015, by: 'Jonathan Hickman, Esad Ribić', why: 'la fin du multivers et sa renaissance', q: 'Secret Wars 2015' },
      { t: 'Time Runs Out', y: 2015, by: 'Jonathan Hickman', why: 'le prélude direct', q: 'Avengers Time Runs Out' }
    ]
  },
  {
    id: 'the-batman-2', title: 'The Batman Part II', studio: 'DC Studios / Warner Bros.', kind: 'film', release: '2027-10-01', releaseLabel: 'au cinéma en octobre 2027 (date annoncée)',
    match: /the batman (part ii|part 2|2)|batman part ii/i, hero: 'Batman',
    watch: [
      { t: 'The Batman', y: 2022, why: 'le premier film de Matt Reeves' },
      { t: 'The Penguin', y: 2024, why: 'la série qui suit directement le film (HBO)' }
    ],
    read: [
      { t: 'Batman : Année Un', y: 1987, by: 'Frank Miller, David Mazzucchelli', why: 'les débuts de Batman et de Gordon', q: 'Batman Year One' },
      { t: 'Un long Halloween', y: 1996, by: 'Jeph Loeb, Tim Sale', why: 'l\'enquête criminelle qui inspire les films', q: 'Batman The Long Halloween' },
      { t: 'Batman : Ego', y: 2000, by: 'Darwyn Cooke', why: 'Bruce face à sa part d\'ombre', q: 'Batman Ego' }
    ]
  },
  {
    id: 'man-of-tomorrow', title: 'Man of Tomorrow', studio: 'DC Studios', kind: 'film', release: '2027-07-09', releaseLabel: 'au cinéma en juillet 2027 (date annoncée)',
    match: /man of tomorrow/i, hero: 'Superman et Lex Luthor',
    watch: [
      { t: 'Superman', y: 2025, why: 'le premier film du nouvel univers DC' },
      { t: 'Peacemaker, saison 2', y: 2025, why: 'la suite de l\'univers DC à la télévision' }
    ],
    read: [
      { t: 'All-Star Superman', y: 2005, by: 'Grant Morrison, Frank Quitely', why: 'le Superman le plus lumineux', q: 'All-Star Superman' },
      { t: 'Superman : Birthright', y: 2003, by: 'Mark Waid, Leinil Francis Yu', why: 'une origine moderne de Superman et de Luthor', q: 'Superman Birthright' },
      { t: 'Lex Luthor : Man of Steel', y: 2005, by: 'Brian Azzarello, Lee Bermejo', why: 'le point de vue de Lex', q: 'Lex Luthor Man of Steel' }
    ]
  },
  {
    id: 'beyond-the-spider-verse', title: 'Spider-Man: Beyond the Spider-Verse', studio: 'Sony Pictures Animation', kind: 'film', release: '2027-06-18', releaseLabel: 'au cinéma en juin 2027 (date annoncée)',
    match: /beyond the spider-?verse|spider-?verse/i, hero: 'Miles Morales',
    watch: [
      { t: 'Spider-Man : New Generation', y: 2018, why: 'le premier film (Into the Spider-Verse)' },
      { t: 'Spider-Man : Across the Spider-Verse', y: 2023, why: 'la première partie, qui finit sur un suspense' }
    ],
    read: [
      { t: 'Miles Morales : Ultimate Spider-Man', y: 2011, by: 'Brian Michael Bendis, Sara Pichelli', why: 'la naissance de Miles', q: 'Miles Morales Ultimate Spider-Man' },
      { t: 'Spider-Verse', y: 2014, by: 'Dan Slott, Olivier Coipel', why: 'toutes les araignées du multivers', q: 'Spider-Verse 2014' },
      { t: 'Spider-Gwen', y: 2015, by: 'Jason Latour, Robbi Rodriguez', why: 'Gwen Stacy en héroïne', q: 'Spider-Gwen' }
    ]
  }
]);

// Dossiers à montrer : ceux dont parle l'actualité récente, puis ceux qui sortent dans l'année
const pick = (articles, now, max = 3) => {
  const t = Date.parse(now || new Date().toISOString());
  const scored = GUIDES.map(g => {
    const hits = (articles || []).filter(a => g.match.test([a && a.title, a && a.excerpt].filter(Boolean).join(' ')));
    const days = (Date.parse(g.release + 'T12:00:00Z') - t) / 86400000;
    return { g, hits, days };
  }).filter(x => x.days > -45 && (x.hits.length || x.days < 400));
  return scored.sort((a, b) => (b.hits.length > 0) - (a.hits.length > 0) || a.days - b.days).slice(0, max)
    .map(x => ({ guide: x.g, articles: x.hits.slice(0, 4), daysLeft: Math.round(x.days) }));
};
const byId = id => GUIDES.find(g => g.id === id) || null;

module.exports = { GUIDES, pick, byId };
