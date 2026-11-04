// Données fixes de l'appli : libellés, listes d'actions, catégories.

export const APP_VERSION = '2.9';
export const STORAGE_KEY = 'bb-stats-2';

// Actions d'un joueur : [code, libellé du bouton, couleur]
// Couleurs : n = positif (vert), f = faute (jaune), r = raté (rouge)
export const ACTS = [
  ['ro', 'Rebond off.', 'n'],
  ['rd', 'Rebond déf.', 'n'],
  ['stl', 'Interception', 'n'],
  ['fd', 'Faute provoquée', 'n'],
  ['to', 'Balle perdue', 'f'],
  ['trav', 'Marcher', 'f'],
  ['m2', 'Raté 2 pts', 'r'],
  ['m3', 'Raté 3 pts', 'r'],
  ['m1', 'Raté LF', 'r'],
];

// Ballons gagnés par l'équipe
export const TACTS = [
  ['w5', '5 secondes', 'n'],
  ['w8', '8 secondes', 'n'],
  ['w24', '24 secondes', 'n'],
  ['wr', 'Ballon récupéré', 'n'],
];

// Rebonds de l'adversaire
export const OACTS = [
  ['orb', 'Rebond offensif', 'n'],
  ['odr', 'Rebond défensif', 'n'],
];

// Ballons gagnés : [code, libellé, libellé court pour les tuiles]
export const WON = [['w5', '5 s'], ['w8', '8 s'], ['w24', '24 s'], ['wr', 'Récup.', 'Rec.']];

// Pastilles de stats sur les boutons joueurs : [code, abréviation, couleur]
export const SG = [
  ['ro', 'RO', 'g'], ['rd', 'RD', 'g'], ['stl', 'Int', 'g'], ['fd', 'FP', 'g'],
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

// Codes des stats individuelles
export const PK = ['ro', 'rd', 'stl', 'fd', 'to', 'trav', 'm1', 'm2', 'm3'];

// Catégories du plus âgé au plus jeune : c'est aussi l'ordre de tri des équipes.
export const CATS = ['Vétéran', 'Sénior', 'Loisir', 'U21', 'U20', 'U18', 'U17', 'U15', 'U13', 'U11', 'U9', 'U7', 'Baby', 'Autre'];

export const SEXES = [['', 'Non précisé'], ['M', 'Masculin (M)'], ['F', 'Féminin (F)'], ['Mixte', 'Mixte']];
