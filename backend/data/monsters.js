// Shared monster data between frontend and backend
export const monsterCards = [
  { id: 'sui-1', name: 'Sui', attack: 35, defense: 15, hp: 100, maxHp: 100 },
  { id: 'grum-1', name: 'Grum', attack: 40, defense: 20, hp: 80, maxHp: 80 },
  { id: 'stomp-1', name: 'Stomp', attack: 45, defense: 25, hp: 60, maxHp: 60 },
  { id: 'blaze-1', name: 'Blaze', attack: 50, defense: 10, hp: 80, maxHp: 80 },
  { id: 'brocco-1', name: 'Brocco', attack: 20, defense: 30, hp: 100, maxHp: 100 },
  { id: 'yeti-1', name: 'Yeti', attack: 30, defense: 30, hp: 80, maxHp: 80 },
  { id: 'nubb-1', name: 'Nubb', attack: 25, defense: 25, hp: 100, maxHp: 100 },
  { id: 'nom-1', name: 'Nom', attack: 35, defense: 15, hp: 100, maxHp: 100 },
  { id: 'cyclo-1', name: 'Cyclo', attack: 40, defense: 20, hp: 80, maxHp: 80 },
  { id: 'glint-1', name: 'Glint', attack: 35, defense: 25, hp: 80, maxHp: 80 },
  { id: 'fluff-1', name: 'Fluff', attack: 15, defense: 35, hp: 100, maxHp: 100 },
  { id: 'captainboo-1', name: 'Captain Boo', attack: 45, defense: 25, hp: 60, maxHp: 60 },
  { id: 'momo-1', name: 'Momo', attack: 30, defense: 30, hp: 80, maxHp: 80 },
  { id: 'slippy-1', name: 'Slippy', attack: 25, defense: 35, hp: 80, maxHp: 80 },
  { id: 'whirl-1', name: 'Whirl', attack: 35, defense: 35, hp: 60, maxHp: 60 },
  { id: 'twispy-1', name: 'Twispy', attack: 30, defense: 30, hp: 80, maxHp: 80 },
  { id: 'pico-1', name: 'Pico', attack: 20, defense: 20, hp: 120, maxHp: 120 },
  { id: 'tuga-1', name: 'Tuga', attack: 10, defense: 40, hp: 100, maxHp: 100 },
  { id: 'kai-1', name: 'Kai', attack: 40, defense: 20, hp: 80, maxHp: 80 },
  { id: 'ruk-1', name: 'Ruk', attack: 45, defense: 15, hp: 80, maxHp: 80 },
  { id: 'pyro-1', name: 'Pyro', attack: 50, defense: 10, hp: 80, maxHp: 80 },
  { id: 'grow-1', name: 'Grow', attack: 25, defense: 35, hp: 80, maxHp: 80 },
  { id: 'luna-1', name: 'Luna', attack: 40, defense: 20, hp: 80, maxHp: 80 },
  { id: 'floar-1', name: 'Floar', attack: 30, defense: 30, hp: 80, maxHp: 80 },
  { id: 'ecron-1', name: 'Ecron', attack: 50, defense: 10, hp: 80, maxHp: 80 }
];

export const getInitialHand = (count = 4) => {
  const shuffled = [...monsterCards].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(card => ({
    ...card,
    hp: card.maxHp
  }));
};