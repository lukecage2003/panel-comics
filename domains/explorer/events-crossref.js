'use strict';
// Recoupement documentaire du catalogue (D-51) : faits relevés le 8 novembre 2026 sur deux guides tiers d'ordres de lecture,
// Comic Book Reading Orders (CBRO) et Reading Orders (readingorders.com), en plus de Wikipédia (events-seed.js).
// Règles :
// - une entrée par source : la provenance de chaque série et de chaque numéro reste distincte ;
// - seuls des faits sont repris (titres de séries, numéros, rattachement à l'événement) ; l'ordre de lecture propre à chaque guide
//   n'est PAS reproduit (sélection et agencement protégés) : aucun readingPos, aucun ordre « guide tiers » recopié ;
// - la relation (prélude, tie-in, série liée…) est celle que le guide indique ; quand il ne la précise pas, le choix est expliqué en note ;
// - les écarts entre sources sont conservés et expliqués (divergences), jamais tranchés ;
// - relevé par lecture outillée des pages publiques : des erreurs de transcription restent possibles, d'où le statut « non vérifié ».
// Aucune image n'est reprise : les deux guides affichent des couvertures dont les droits appartiennent aux éditeurs.

const LIC_GUIDE = 'Guide tiers protégé par le droit d\'auteur : seuls des faits (séries et numéros cités) sont repris ; l\'ordre de lecture du guide n\'est pas reproduit ; aucune image.';
const cbro = (key, title, path) => ({ id: 'src_cbro_' + key, label: 'Comic Book Reading Orders — ' + title, url: 'https://comicbookreadingorders.com/' + path, retrievedAt: '2026-11-08', license: LIC_GUIDE, kind: 'guide' });
const ro = (key, title, slug) => ({ id: 'src_ro_' + key, label: 'Reading Orders — ' + title, url: 'https://www.readingorders.com/reading-orders/' + slug, retrievedAt: '2026-11-08', license: LIC_GUIDE, kind: 'guide' });
// [série, volume, numéros, note?]
const L = (relation, sourceId, rows) => rows.map(([series, volume, issues, note]) => ({ relation, series, volume: volume || '', issues: issues || '', note: note || '', sourceId }));
const D = (topic, text, sourceIds) => ({ topic, text, sourceIds });

const CROSSREF = {
  gd_infinity_gauntlet: {
    sources: [cbro('ig', 'Infinity Gauntlet', 'marvel/events/infinity-gauntlet-reading-order/')],
    links: [
      ...L('prelude', 'src_cbro_ig', [['Silver Surfer', 'Vol. 3', '34-38, 40-50'], ['The Thanos Quest', '', '1-2'], ['Cloak and Dagger', 'Vol. 3', '17-18', 'Titre exact selon le guide : The Mutant Misadventures of Cloak and Dagger.'], ['Spider-Man', '', '17']]),
      ...L('tie_in', 'src_cbro_ig', [['Silver Surfer', 'Vol. 3', '51-60'], ['Sleepwalker', '', '6-7'], ['Quasar', '', '26-27'], ['Doctor Strange, Sorcerer Supreme', '', '31-36'], ['The Incredible Hulk', 'Vol. 2', '383-385']]),
      ...L('aftermath', 'src_cbro_ig', [['Warlock and the Infinity Watch', '', '1']])],
    divergences: [
      D('Silver Surfer Vol. 3', 'Wikipédia cite les #34-50 en prélude et #51-59 en tie-ins ; CBRO omet le #39 et ajoute le #60.', ['src_wp_ig', 'src_cbro_ig']),
      D('Cloak and Dagger Vol. 3', 'Wikipédia classe le #18 parmi les tie-ins ; CBRO place les #17-18 avant l\'événement.', ['src_wp_ig', 'src_cbro_ig']),
      D('Tie-ins de 1991', 'CBRO ajoute Incredible Hulk #383, Quasar #27 et Sleepwalker #6 aux numéros cités par Wikipédia.', ['src_wp_ig', 'src_cbro_ig'])],
    uncertain: [{ text: 'Reading Orders n\'affiche pas de liste pour cet événement à la date du relevé.', sourceId: '' }]
  },
  gd_house_of_m: {
    sources: [cbro('hom', 'House of M', 'marvel/events/house-of-m-reading-order/')],
    links: [
      ...L('prelude', 'src_cbro_hom', [['Excalibur', 'Vol. 3', '1-14', 'Le guide marque les #1-12 comme facultatifs.']]),
      ...L('tie_in', 'src_cbro_hom', [['Fantastic Four: House of M', '', '1-3'], ['Iron Man: House of M', '', '1-3'], ['Spider-Man: House of M', '', '1-5'], ['Mutopia X', '', '1-4'],
        ['Uncanny X-Men', '', '462-465'], ['New X-Men: Academy X', '', '16-19', 'Intitulé New X-Men (Vol. 2) par le guide.'], ['The Incredible Hulk', 'Vol. 2', '83-86'], ['Wolverine', 'Vol. 3', '33-35'],
        ['Captain America', 'Vol. 5', '10'], ['Black Panther', 'Vol. 4', '7'], ['Cable & Deadpool', '', '17'], ['Exiles', '', '69-71'], ['New Thunderbolts', '', '11'], ['The Pulse', '', '10'],
        ['The Pulse: House of M Special', '', '1'], ['Giant-Size Ms. Marvel', '', '1']]),
      ...L('related_series', 'src_cbro_hom', [['Civil War: House of M', '', '1-5', 'Publiée en 2008-2009 ; listée par le guide avec l\'événement.'], ['House of M: Avengers', '', '1-5', 'Publiée en 2008 ; listée par le guide avec l\'événement.'],
        ['House of M: Masters of Evil', '', '1-4', 'Publiée en 2009-2010 ; listée par le guide avec l\'événement.']])],
    divergences: [
      D('Mutopia X', 'Wikipédia cite cinq numéros, CBRO quatre (#1-4).', ['src_wp_hom', 'src_cbro_hom']),
      D('Excalibur Vol. 3', 'Wikipédia classe les #11-12 parmi les tie-ins et les #13-14 en introduction ; CBRO place les #1-14 avant l\'événement.', ['src_wp_hom', 'src_cbro_hom'])],
    uncertain: [{ text: 'La page Reading Orders consultée n\'affichait aucune liste.', sourceId: '' }]
  },
  gd_civil_war: {
    sources: [cbro('cw', 'Civil War', 'marvel/events/civil-war-reading-order/')],
    links: [
      ...L('prelude', 'src_cbro_cw', [['Iron Man', 'Vol. 4', '1-6', 'Intitulé Invincible Iron Man (2005) par le guide.'], ['Secret War', '', '1-5'], ['New Avengers', '', '1-20'], ['New Warriors', 'Vol. 3', '1-6']]),
      ...L('tie_in', 'src_cbro_cw', [['Civil War: Front Line', '', '1-11'], ['Civil War: X-Men', '', '1-4'], ['Civil War: Young Avengers/Runaways', '', '1-4'], ['Civil War: The Initiative', '', '1'],
        ['Fallen Son: The Death of Captain America', '', '1-5'], ['Civil War: Opening Shot', '', '1'], ['New Avengers: Illuminati', '', '1', 'One-shot de 2006.'], ['Amazing Spider-Man', 'Vol. 2', '529-538'],
        ['Fantastic Four', 'Vol. 3', '536-543'], ['Wolverine', 'Vol. 3', '42-48'], ['She-Hulk', 'Vol. 2', '8-9'], ['X-Factor', 'Vol. 3', '8-9'], ['New Avengers', '', '21-25'], ['New X-Men', 'Vol. 2', '28-31'],
        ['Thunderbolts', '', '103-108'], ['Sensational Spider-Man', 'Vol. 2', '28-34'], ['Ms. Marvel', 'Vol. 2', '6-10'], ['Black Panther', 'Vol. 4', '18-25'], ['Heroes for Hire', 'Vol. 2', '1-3'],
        ['Cable & Deadpool', '', '30-32'], ['Captain America', 'Vol. 5', '22-25'], ['Punisher War Journal', 'Vol. 2', '1-5'], ['Moon Knight', 'Vol. 5', '7-12'], ['Blade', 'Vol. 5', '5'],
        ['Daily Bugle Special Edition: Civil War', '', '1'], ['Iron Man/Captain America: Casualties of War', '', '1'], ['Civil War Files', '', '1'], ['Civil War: Choosing Sides', '', '1'], ['Civil War: War Crimes', '', '1'],
        ['Winter Soldier: Winter Kills', '', '1'], ['Civil War: The Return', '', '1'], ['Civil War: The Confession', '', '1'], ['Civil War: Battle Damage Report', '', '1'],
        ['Invincible Iron Man', 'Vol. 2', '13-14', 'Numéros publiés en 2009, insérés dans la liste par le guide.']]),
      ...L('aftermath', 'src_cbro_cw', [['Amazing Spider-Man', 'Vol. 2', '539-543', 'Le guide cite le #539 à la fois dans l\'événement et après.']])],
    divergences: [
      D('Tie-ins', 'Wikipédia ne nomme que cinq séries liées, sans numéros ; CBRO en détaille une quarantaine avec leurs numéros.', ['src_wp_cw', 'src_cbro_cw']),
      D('Amazing Spider-Man #539', 'Le même guide (CBRO) le cite dans l\'événement et dans la suite.', ['src_cbro_cw'])],
    uncertain: [{ text: 'Reading Orders affiche des positions de lecture et non des numéros : non exploité.', sourceId: '' }]
  },
  gd_crisis_infinite_earths: {
    sources: [cbro('coie', 'Crisis on Infinite Earths', 'dc/events/crisis-on-infinite-earths-reading-order/'), ro('coie', 'Crisis on Infinite Earths', 'crisis-on-infinite-earths')],
    links: [
      ...L('prelude', 'src_cbro_coie', [['Action Comics', '', '560, 564'], ['All-Star Squadron', '', '40'], ['Amethyst', 'Vol. 2', '2'], ['Batman', '', '384'], ['Batman and the Outsiders', '', '14-15'],
        ['Blue Devil', '', '5'], ['DC Comics Presents', '', '76, 78'], ['Detective Comics', '', '551'], ['G.I. Combat', '', '274-275'], ['Green Lantern', 'Vol. 2', '173, 176, 178'], ['Infinity, Inc.', '', '8'],
        ['Jonah Hex', '', '90'], ['Justice League of America', '', '232, 234'], ['The New Teen Titans', '', '21'], ['The New Teen Titans Annual', '', '2'], ['Superman', '', '402-403'], ['Swamp Thing', 'Vol. 2', '30-31'],
        ['Tales of the Legion of Super-Heroes', '', '317, 319, 320'], ['Tales of the Teen Titans', '', '47, 58'], ['The Flash', '', '338, 339, 350'], ['The Fury of Firestorm', '', '28'], ['Vigilante', '', '14'],
        ['Warlord', '', '91'], ['Wonder Woman', '', '321, 323'], ['World\'s Finest Comics', '', '311']]),
      ...L('crossover', 'src_cbro_coie', [['All-Star Squadron', '', '50-56'], ['Amethyst', 'Vol. 2', '13'], ['Batman', '', '389-391'], ['Blue Devil', '', '18'], ['DC Comics Presents', '', '86-88'],
        ['Detective Comics', '', '556-558'], ['Green Lantern', 'Vol. 2', '194-198'], ['Infinity, Inc.', '', '18-24'], ['Infinity, Inc. Annual', '', '1'], ['Justice League of America', '', '244-245'],
        ['Justice League of America Annual', '', '3'], ['Legion of Super-Heroes', 'Vol. 3', '16, 18'], ['The New Teen Titans', 'Vol. 2', '13'], ['The Omega Men', '', '31'], ['Superman', '', '414-415'],
        ['Swamp Thing', 'Vol. 2', '44-46'], ['The Fury of Firestorm', '', '41-42'], ['Vigilante', '', '22'], ['Wonder Woman', '', '328-329']]),
      ...L('crossover', 'src_ro_coie', [['All-Star Squadron', '', '50-56'], ['Amethyst', 'Vol. 2', '13', 'Intitulé Amethyst, Princess of Gemworld par le guide.'], ['Batman', '', '389-391'], ['Blue Devil', '', '17-18'],
        ['DC Comics Presents', '', '78, 86-88'], ['Detective Comics', '', '556-558'], ['The Fury of Firestorm', '', '41-42'], ['Green Lantern', 'Vol. 2', '194-198'], ['Infinity, Inc.', '', '18-25'],
        ['Infinity, Inc. Annual', '', '1'], ['Justice League of America', '', '244-245'], ['Justice League of America Annual', '', '3'], ['Legion of Super-Heroes', 'Vol. 3', '16-18'], ['The Losers Special', '', '1'],
        ['The New Teen Titans', 'Vol. 2', '13-14'], ['The Omega Men', '', '31'], ['Swamp Thing', 'Vol. 2', '44-46', 'Intitulé The Saga of the Swamp Thing par le guide.'], ['Superman', '', '414-415'], ['The Flash', '', '350'],
        ['Tales of the Teen Titans', '', '58'], ['Vigilante', '', '22'], ['Wonder Woman', '', '327-329']]),
      ...L('related_series', 'src_cbro_coie', [['Legends of the DC Universe: Crisis on Infinite Earths', '', '1', 'One-shot de 1999.']]),
      ...L('related_series', 'src_ro_coie', [['Legends of the DC Universe: Crisis on Infinite Earths', '', '1', 'One-shot de 1999.'], ['The Legend of Wonder Woman', '', '1-4', 'Publiée en 1986.']])],
    divergences: [
      D('Numéros des crossovers', 'Les deux guides diffèrent : Infinity, Inc. #18-24 (CBRO) ou #18-25 (Reading Orders) ; Wonder Woman #328-329 ou #327-329 ; Blue Devil #18 ou #17-18 ; Legion of Super-Heroes #16 et #18 ou #16-18 ; New Teen Titans Vol. 2 #13 ou #13-14.', ['src_cbro_coie', 'src_ro_coie']),
      D('Préparation ou crossover', 'The Flash #350, Tales of the Teen Titans #58 et DC Comics Presents #78 sont placés avant l\'événement par CBRO, parmi les crossovers par Reading Orders.', ['src_cbro_coie', 'src_ro_coie']),
      D('Séries croisées', 'Wikipédia nomme dix séries sans numéros ; certaines (History of the DC Universe) n\'apparaissent pas dans les guides.', ['src_wp_coie'])]
  },
  gd_infinite_crisis: {
    sources: [cbro('ic', 'Infinite Crisis', 'dc/events/infinite-crisis-reading-order/'), ro('ic', 'Infinite Crisis', 'infinite-crisis')],
    links: [
      ...L('tie_in', 'src_cbro_ic', [['Gotham Central', '', '37-40'], ['JLA', '', '124-125'], ['Outsiders', 'Vol. 3', '29-33'], ['Teen Titans', 'Vol. 3', '29-33'], ['Teen Titans Annual', '', '1'],
        ['Wonder Woman', 'Vol. 2', '222-226'], ['Superman', 'Vol. 2', '223-226'], ['Adventures of Superman', '', '646-649'], ['Firestorm', 'Vol. 3', '19-22'], ['Green Lantern', 'Vol. 4', '7-8'],
        ['Birds of Prey', '', '86-91'], ['Aquaman', 'Vol. 6', '32-39', 'Renommée Aquaman: Sword of Atlantis à partir du #40 selon le guide.'], ['Green Arrow', 'Vol. 3', '54-59'], ['JSA Classified', '', '4, 8-9'],
        ['JSA', '', '81-82'], ['Hawkman', 'Vol. 4', '47-49'], ['Robin', 'Vol. 2', '143-147'], ['Manhunter', 'Vol. 3', '16-19'], ['Nightwing', 'Vol. 2', '116-117'], ['Batman', '', '648-650'],
        ['Batman Annual', '', '25'], ['Catwoman', 'Vol. 3', '52'], ['Action Comics', '', '836'], ['Superman/Batman', '', '26'], ['Superman', '', '712', 'Numéro cité par les deux guides ; publication bien postérieure à l\'événement.'],
        ['Crisis Aftermath: The Spectre', '', '1-3'], ['Infinite Crisis Special: Day of Vengeance', '', '1'], ['Infinite Crisis Special: Rann-Thanagar War', '', '1'], ['Infinite Crisis Special: The OMAC Project', '', '1'],
        ['Infinite Crisis Special: Villains United', '', '1'], ['Infinite Crisis Secret Files and Origins', '', '1']]),
      ...L('tie_in', 'src_ro_ic', [['Gotham Central', '', '37-40'], ['JLA', '', '122-125'], ['Outsiders', 'Vol. 3', '29-33'], ['Teen Titans', 'Vol. 3', '29-33'], ['Teen Titans Annual', '', '1'],
        ['Wonder Woman', 'Vol. 2', '222-226'], ['Superman', 'Vol. 2', '223-226'], ['Adventures of Superman', '', '645-649'], ['Firestorm', 'Vol. 3', '19-22'], ['Green Lantern', 'Vol. 4', '7-8'],
        ['Birds of Prey', '', '86-91'], ['Aquaman', 'Vol. 6', '32-39'], ['Green Arrow', 'Vol. 3', '54-59'], ['JSA Classified', '', '4, 8-9'], ['JSA', '', '78-82'], ['Hawkman', 'Vol. 4', '47-49'],
        ['Robin', 'Vol. 2', '143-147'], ['Manhunter', 'Vol. 3', '16-19'], ['Nightwing', 'Vol. 2', '116-117'], ['Batman', '', '648-650'], ['Batman Annual', '', '25'], ['Catwoman', 'Vol. 3', '52'],
        ['Action Comics', '', '836'], ['Superman/Batman', '', '26'], ['Superman', '', '712'], ['Crisis Aftermath: The Spectre', '', '1-3'], ['Crisis Aftermath: The Battle for Blüdhaven', '', '1-6'],
        ['Day of Vengeance', '', '5-6'], ['Infinite Crisis Special: Day of Vengeance', '', '1'], ['Infinite Crisis Special: Rann-Thanagar War', '', '1'], ['Infinite Crisis Special: The OMAC Project', '', '1'],
        ['Infinite Crisis Special: Villains United', '', '1'], ['Infinite Crisis Secret Files and Origins', '', '1']])],
    divergences: [
      D('Numéros des tie-ins', 'JLA #124-125 (CBRO) ou #122-125 (Reading Orders) ; JSA #81-82 ou #78-82 ; Adventures of Superman #646-649 ou #645-649.', ['src_cbro_ic', 'src_ro_ic']),
      D('Day of Vengeance', 'Wikipédia la classe parmi les préludes (sans numéros) ; Reading Orders cite les #5-6 dans l\'événement.', ['src_wp_ic', 'src_ro_ic']),
      D('Superman #712', 'Cité par les deux guides alors que sa publication est bien postérieure à l\'événement : rattachement à vérifier.', ['src_cbro_ic', 'src_ro_ic'])],
    unidentified: [{ text: 'Crisis Aftermath : Reading Orders cite cette entrée sans numéro identifiable.', sourceId: 'src_ro_ic' }]
  },
  gd_blackest_night: {
    sources: [cbro('bn', 'Blackest Night', 'dc/events/blackest-night-reading-order/'), ro('bn', 'Blackest Night', 'blackest-night')],
    links: [
      ...['src_cbro_bn', 'src_ro_bn'].flatMap(s => L('tie_in', s, [['Green Lantern', 'Vol. 4', '43-52'], ['Green Lantern Corps', 'Vol. 2', '39-47'], ['Blackest Night: Tales of the Corps', '', '1-3'],
        ['Blackest Night: Batman', '', '1-3'], ['Blackest Night: Superman', '', '1-3'], ['Blackest Night: Titans', '', '1-3'], ['Blackest Night: The Flash', '', '1-3'], ['Blackest Night: JSA', '', '1-3'],
        ['Blackest Night: Wonder Woman', '', '1-3'], ['Adventure Comics', 'Vol. 2', '4-5, 7'], ['Titans', 'Vol. 2', '15'], ['Solomon Grundy', '', '7'], ['Superman/Batman', '', '66-67'], ['The Phantom Stranger', 'Vol. 2', '42'],
        ['Suicide Squad', '', '67'], ['Secret Six', 'Vol. 3', '17-18'], ['Catwoman', 'Vol. 3', '83'], ['The Outsiders', 'Vol. 4', '24-25'], ['R.E.B.E.L.S.', 'Vol. 2', '10-11'], ['Doom Patrol', 'Vol. 5', '4-5'],
        ['Booster Gold', 'Vol. 2', '26-27'], ['Teen Titans', 'Vol. 3', '77-78'], ['Weird Western Tales', '', '71'], ['Starman', 'Vol. 2', '81'], ['The Power of Shazam!', '', '48'], ['The Question', '', '37'],
        ['Green Arrow and Black Canary', '', '30', s === 'src_ro_bn' ? 'Intitulé Green Arrow par le guide.' : ''], ['The Atom and Hawkman', '', '46']])),
      ...L('tie_in', 'src_cbro_bn', [['Justice League of America', 'Vol. 2', '38-40']]),
      ...L('tie_in', 'src_ro_bn', [['Justice League of America', 'Vol. 2', '39-40'], ['Untold Tales of Blackest Night', '', '1'], ['Action Comics', '', '890']]),
      ...L('related_series', 'src_ro_bn', [['Blackest Night: Director\'s Cut', '', '1', 'Édition commentée de 2010.']])],
    divergences: [
      D('Justice League of America Vol. 2', 'CBRO cite les #38-40, Reading Orders les #39-40.', ['src_cbro_bn', 'src_ro_bn']),
      D('Numéros présents dans un seul guide', 'Reading Orders ajoute Untold Tales of Blackest Night #1 et Action Comics #890.', ['src_ro_bn']),
      D('Nature de l\'ordre', 'Reading Orders propose un ordre recommandé hiérarchisé (essentiel, recommandé, facultatif) ; il n\'est ni l\'ordre de publication ni la chronologie de l\'univers.', ['src_ro_bn'])]
  },
  gd_flashpoint: {
    sources: [cbro('fp', 'Flashpoint', 'dc/events/flashpoint-reading-order/'), ro('fp', 'Flashpoint', 'flashpoint')],
    links: [
      ...['src_cbro_fp', 'src_ro_fp'].flatMap(s => [
        ...L('prelude', s, [['The Flash', 'Vol. 3', '8-12']]),
        ...L('tie_in', s, [['Flashpoint: Reverse-Flash', '', '1'], ['Flashpoint: Project Superman', '', '1-3'], ['Flashpoint: Wonder Woman and the Furies', '', '1-3'], ['Flashpoint: Green Arrow Industries', '', '1'],
          ['Flashpoint: Lois Lane and the Resistance', '', '1-3'], ['Flashpoint: The Canterbury Cricket', '', '1'], ['Flashpoint: Deadman and the Flying Graysons', '', '1-3'], ['Flashpoint: Grodd of War', '', '1'],
          ['Flashpoint: The Legion of Doom', '', '1-3'], ['Flashpoint: Abin Sur – The Green Lantern', '', '1-3'], ['Flashpoint: Hal Jordan', '', '1-3'], ['Flashpoint: The Outsider', '', '1-3'], ['Flashpoint: Secret Seven', '', '1-3'],
          ['Flashpoint: Citizen Cold', '', '1-3'], ['Flashpoint: Deathstroke & the Curse of the Ravager', '', '1-3'], ['Flashpoint: Batman – Knight of Vengeance', '', '1-3'],
          ['Flashpoint: Frankenstein and the Creatures of the Unknown', '', '1-3'], ['The World of Flashpoint', '', '1-3'], ['Flashpoint: Emperor Aquaman', '', '1-3'], ['Flashpoint: Kid Flash Lost', '', '1-3']]),
        ...L('crossover', s, [['Booster Gold', 'Vol. 2', '44-47']])]),
      ...L('related_series', 'src_ro_fp', [['The Flash: Rebirth', '', '1-6', 'Lecture préalable facultative proposée par ce guide.'], ['Time Masters: Vanishing Point', '', '1-6', 'Lecture préalable proposée par ce guide (#1-5 facultatifs).']])],
    divergences: [D('Lectures préalables', 'Seul Reading Orders propose The Flash: Rebirth et Time Masters: Vanishing Point ; ce sont des conseils de lecture, pas des tie-ins.', ['src_ro_fp'])]
  },
  gd_secret_wars_1984: {
    sources: [],
    links: [],
    uncertain: [{ text: 'Aucune page dédiée trouvée sur CBRO ni sur Reading Orders à la date du relevé : fiche à source unique.', sourceId: '' }]
  }
};

// King in Black : la source CBRO du guide (src_cbro) existe déjà ; Reading Orders ajouté
const KIB_CROSSREF = {
  sources: [ro('kib', 'King in Black', 'king-in-black')],
  links: [
    ...L('tie_in', 'src_cbro', [['Symbiote Spider-Man: King in Black', '', '1-5'], ['King in Black: Namor', '', '1-5'], ['Atlantis Attacks', '', '5'], ['King in Black: Wiccan and Hulkling', '', '1'], ['The Union', '', '1-2'],
      ['Black Cat', 'Vol. 2', '1-3'], ['Spider-Woman', 'Vol. 7', '7-8'], ['Guardians of the Galaxy', 'Vol. 6', '10'], ['King in Black: Ghost Rider', '', '1'], ['King in Black: Black Knight', '', '1'], ['King in Black: Black Panther', '', '1'],
      ['King in Black: Iron Man/Doom', '', '1'], ['King in Black: Return of the Valkyries', '', '1-4'], ['King in Black: Planet of the Symbiotes', '', '1-3'], ['King in Black: Thunderbolts', '', '1-3'],
      ['King in Black: Gwenom vs. Carnage', '', '1-3'], ['King in Black: Immortal Hulk', '', '1'], ['S.W.O.R.D.', 'Vol. 2', '2-4'], ['Daredevil', 'Vol. 6', '26-27'], ['Deadpool', 'Vol. 7', '10'], ['King in Black: Marauders', '', '1'],
      ['Savage Avengers', '', '17-19'], ['Miles Morales: Spider-Man', '', '23'], ['King in Black: Captain America', '', '1'], ['King in Black: Scream', '', '1'], ['King in Black: Spider-Man', '', '1'],
      ['Fantastic Four', 'Vol. 6', '29-30'], ['Avengers', 'Vol. 8', '45']]),
    ...L('tie_in', 'src_ro_kib', [['Symbiote Spider-Man: King in Black', '', '1-5'], ['King in Black: Namor', '', '1-5'], ['Atlantis Attacks', '', '5'], ['King in Black: Wiccan and Hulkling', '', '1'], ['The Union', '', '1-2'],
      ['Black Cat', 'Vol. 2', '1-3'], ['Spider-Woman', 'Vol. 7', '7-8'], ['Guardians of the Galaxy', 'Vol. 6', '10'], ['King in Black: Ghost Rider', '', '1'], ['King in Black: Black Knight', '', '1'], ['King in Black: Black Panther', '', '1'],
      ['King in Black: Iron Man/Doom', '', '1', 'Intitulé Iron Man/Doctor Doom par le guide.'], ['King in Black: Return of the Valkyries', '', '1-4'], ['King in Black: Planet of the Symbiotes', '', '1-3'], ['King in Black: Thunderbolts', '', '1-3'],
      ['King in Black: Gwenom vs. Carnage', '', '1-3'], ['King in Black: Immortal Hulk', '', '1'], ['S.W.O.R.D.', 'Vol. 2', '2-4'], ['Daredevil', 'Vol. 6', '26-27'], ['Deadpool', 'Vol. 7', '10'], ['King in Black: Marauders', '', '1'],
      ['Savage Avengers', '', '17-19'], ['Miles Morales: Spider-Man', '', '23'], ['King in Black: Captain America', '', '1'], ['King in Black: Scream', '', '1'], ['King in Black: Spider-Man', '', '1', 'Intitulé King in Black: The Amazing Spider-Man par le guide.'],
      ['Fantastic Four', 'Vol. 6', '29-30'], ['Avengers', 'Vol. 8', '45'], ['Beta Ray Bill', '', '1']]),
    ...L('related_series', 'src_ro_kib', [['King in Black Handbook', '', '1'], ['Venom', 'Vol. 4', '1-12, 16-35', 'Lecture préalable proposée par ce guide ; #35 également numéroté #200.'],
      ['Absolute Carnage', '', '1-5', 'Événement antérieur (2019) que ce guide range parmi les tie-ins.'], ['Web of Venom: Empyre\'s End', '', '1']])],
  divergences: [
    D('Atlantis Attacks', 'Wikipédia cite la série sans préciser de numéro ; les deux guides retiennent le #5.', ['src_wp_kib', 'src_cbro', 'src_ro_kib']),
    D('Année de la série principale', 'CBRO date King in Black de 2021, Reading Orders de 2020 ; Wikipédia situe le #1 le 2 décembre 2020 (date de sortie) — l\'écart tient probablement à la date de couverture.', ['src_cbro', 'src_ro_kib', 'src_wp_kib']),
    D('Venom Vol. 4', 'CBRO retient les #31-35 avec l\'événement ; Reading Orders conseille une lecture préalable beaucoup plus large (#1-12, 16-35).', ['src_cbro', 'src_ro_kib']),
    D('Beta Ray Bill #1', 'Cité par Reading Orders seulement.', ['src_ro_kib'])]
};

module.exports = { CROSSREF, KIB_CROSSREF, CROSSREF_RETRIEVED: '2026-11-08' };
