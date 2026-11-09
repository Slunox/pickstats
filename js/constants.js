// Données fixes de l'appli : libellés, listes d'actions, catégories.

export const APP_VERSION = '3.2';
// Mode démo (index.html?demo, utilisé par demo.html) : données à part, sans club en ligne,
// pour ne jamais toucher aux vraies données de l'appareil.
export const DEMO = typeof location !== 'undefined' && /[?&]demo(=|&|$)/.test(location.search);
export const STORAGE_KEY = DEMO ? 'bb-demo' : 'bb-stats-2';

// Actions d'un joueur : [code, libellé du bouton, couleur]
// Couleurs : n = positif (vert), f = faute (jaune), r = raté (rouge)
// Les rebonds sont des stats d'équipe (boutons directs sur la saisie), plus des stats individuelles.
export const ACTS = [
  ['stl', 'Interception', 'n'],
  ['fd', 'Faute provoquée', 'n'],
  ['to', 'Balle perdue', 'f'],
  ['trav', 'Marcher', 'f'],
  ['m2', 'Raté 2 pts', 'r'],
  ['m3', 'Raté 3 pts', 'r'],
  ['m1', 'Raté LF', 'r'],
];

// Tirs ratés : après l'un d'eux, l'appli demande qui a pris le rebond.
export const MISS = ['m1', 'm2', 'm3'];

// Boutons directs des équipes sur la saisie : [code, libellé]
export const TEAM_REB = [['ro', 'Offensif'], ['rd', 'Défensif']];
export const OPP_REB = [['orb', 'Offensif'], ['odr', 'Défensif']];

// Ballons gagnés : [code, libellé, libellé court pour les tuiles]
export const WON = [['w5', '5 s'], ['w8', '8 s'], ['w24', '24 s'], ['wr', 'Récup.', 'Rec.']];

// Pastilles de stats sur les boutons joueurs : [code, abréviation, couleur]
export const SG = [
  ['stl', 'Int', 'g'], ['fd', 'FP', 'g'],
  ['to', 'BP', 'f'], ['trav', 'Mar', 'f'],
  ['m2', '2pts ✗', 'r'], ['m3', '3pts ✗', 'r'], ['m1', 'LF ✗', 'r'],
];

// Couleur des étiquettes dans l'historique
export const TAGC = {
  ro: 'g', rd: 'g', stl: 'g', fd: 'g', w5: 'g', w8: 'g', w24: 'g', wr: 'g',
  to: 'f', trav: 'f', m1: 'r', m2: 'r', m3: 'r', orb: 'o', odr: 'o',
};

export const LBL = {
  ro: 'Rebond offensif', rd: 'Rebond défensif', stl: 'Interception', fd: 'Faute provoquée',
  to: 'Balle perdue', trav: 'Marcher', m2: 'Raté 2 pts', m3: 'Raté 3 pts', m1: 'Raté LF',
  w5: 'Ballon gagné 5 s', w8: 'Ballon gagné 8 s', w24: 'Ballon gagné 24 s', wr: 'Ballon récupéré',
  orb: 'Rebond offensif adverse', odr: 'Rebond défensif adverse',
};

// Corrections possibles dans l'historique : code → [code corrigé, libellé du bouton]
export const SWAP = {
  m2: ['m3', '3 pts'], m3: ['m2', '2 pts'],
  ro: ['rd', 'Déf.'], rd: ['ro', 'Off.'],
  orb: ['odr', 'Déf.'], odr: ['orb', 'Off.'],
};

// Codes des stats individuelles (les rebonds n'en font plus partie)
export const PK = ['stl', 'fd', 'to', 'trav', 'm1', 'm2', 'm3'];

// Catégories du plus âgé au plus jeune : c'est aussi l'ordre de tri des équipes.
export const CATS = ['Vétéran', 'Sénior', 'Loisir', 'U21', 'U20', 'U18', 'U17', 'U15', 'U13', 'U11', 'U9', 'U7', 'Baby', 'Autre'];

export const SEXES = [['', 'Non précisé'], ['M', 'Masculin (M)'], ['F', 'Féminin (F)'], ['Mixte', 'Mixte']];
