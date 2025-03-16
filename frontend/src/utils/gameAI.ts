import { CardType } from '../types/game';

export class GameAI {
  // Basic AI decision making
  decideMove(aiHand: CardType[], playerField: CardType[]) {
    // Random but smart-ish decisions
    // - Play stronger cards against threats
    // - Don't waste high-attack monsters on empty field
    // - Consider HP when making decisions
    return this.selectBestCard(aiHand, playerField);
  }

  private selectBestCard(hand: CardType[], playerField: CardType[]) {
    if (playerField.length === 0) {
      // Play random card if field is empty
      return hand[Math.floor(Math.random() * hand.length)];
    }
    // Basic strategy otherwise
    return this.findBestMatch(hand, playerField);
  }

  private findBestMatch(hand: CardType[], playerField: CardType[]): CardType {
    // If opponent has cards, try to counter them
    if (playerField.length > 0) {
      const opponentCard = playerField[0];
      // Find the best card to counter opponent
      return hand.reduce((best, current) => {
        if (current.attack > best.attack && current.attack > opponentCard.defense) {
          return current;
        }
        return best;
      }, hand[0]);
    }
    
    // If no opponent cards, play strongest card
    return hand.reduce((best, current) => 
      current.attack > best.attack ? current : best
    , hand[0]);
  }
}