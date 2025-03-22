// Shared monster data between frontend and backend
export const monsterCards = [
  { id: 'sui', name: 'Sui', attack: 35, defense: 15, hp: 100, maxHp: 100, imageUrl: '/monsters/sui.png' },
  { id: 'grum', name: 'Grum', attack: 40, defense: 20, hp: 80, maxHp: 80, imageUrl: '/monsters/grum.png' },
  { id: 'stomp', name: 'Stomp', attack: 45, defense: 25, hp: 60, maxHp: 60, imageUrl: '/monsters/stomp.png' },
  { id: 'blaze', name: 'Blaze', attack: 50, defense: 10, hp: 80, maxHp: 80, imageUrl: '/monsters/blaze.png' },
  { id: 'brocco', name: 'Brocco', attack: 20, defense: 30, hp: 100, maxHp: 100, imageUrl: '/monsters/brocco.png' },
  { id: 'yeti', name: 'Yeti', attack: 30, defense: 30, hp: 80, maxHp: 80, imageUrl: '/monsters/yeti.png' },
  { id: 'nubb', name: 'Nubb', attack: 25, defense: 25, hp: 100, maxHp: 100, imageUrl: '/monsters/nubb.png' },
  { id: 'nom', name: 'Nom', attack: 35, defense: 15, hp: 100, maxHp: 100, imageUrl: '/monsters/nom.png' },
  { id: 'cyclo', name: 'Cyclo', attack: 40, defense: 20, hp: 80, maxHp: 80, imageUrl: '/monsters/cyclo.png' },
  { id: 'glint', name: 'Glint', attack: 35, defense: 25, hp: 80, maxHp: 80, imageUrl: '/monsters/glint.png' },
  { id: 'fluff', name: 'Fluff', attack: 15, defense: 35, hp: 100, maxHp: 100, imageUrl: '/monsters/fluff.png' },
  { id: 'captainboo', name: 'Captain Boo', attack: 45, defense: 25, hp: 60, maxHp: 60, imageUrl: '/monsters/captainboo.png' },
  { id: 'momo', name: 'Momo', attack: 30, defense: 30, hp: 80, maxHp: 80, imageUrl: '/monsters/momo.png' },
  { id: 'slippy', name: 'Slippy', attack: 25, defense: 35, hp: 80, maxHp: 80, imageUrl: '/monsters/slippy.png' },
  { id: 'whirl', name: 'Whirl', attack: 35, defense: 35, hp: 60, maxHp: 60, imageUrl: '/monsters/whirl.png' },
  { id: 'twispy', name: 'Twispy', attack: 30, defense: 30, hp: 80, maxHp: 80, imageUrl: '/monsters/twispy.png' },
  { id: 'pico', name: 'Pico', attack: 20, defense: 20, hp: 120, maxHp: 120, imageUrl: '/monsters/pico.png' },
  { id: 'tuga', name: 'Tuga', attack: 10, defense: 40, hp: 100, maxHp: 100, imageUrl: '/monsters/tuga.png' },
  { id: 'kai', name: 'Kai', attack: 40, defense: 20, hp: 80, maxHp: 80, imageUrl: '/monsters/kai.png' },
  { id: 'ruk', name: 'Ruk', attack: 45, defense: 15, hp: 80, maxHp: 80, imageUrl: '/monsters/ruk.png' },
  { id: 'pyro', name: 'Pyro', attack: 50, defense: 10, hp: 80, maxHp: 80, imageUrl: '/monsters/pyro.png' },
  { id: 'grow', name: 'Grow', attack: 25, defense: 35, hp: 80, maxHp: 80, imageUrl: '/monsters/grow.png' },
  { id: 'luna', name: 'Luna', attack: 40, defense: 20, hp: 80, maxHp: 80, imageUrl: '/monsters/luna.png' },
  { id: 'floar', name: 'Floar', attack: 30, defense: 30, hp: 80, maxHp: 80, imageUrl: '/monsters/floar.png' },
  { id: 'ecron', name: 'Ecron', attack: 50, defense: 10, hp: 80, maxHp: 80, imageUrl: '/monsters/ecron.png' }
];

export const getInitialHand = (count = 4) => {
  const shuffled = [...monsterCards].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(card => ({
    ...card,
    hp: card.maxHp
  }));
};