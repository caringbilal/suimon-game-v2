// game.js
class Battle {
    constructor() {
        this.playerHP = 300;        // Starting HP for player
        this.opponentHP = 300;      // Starting HP for opponent
        this.fightInterval = 0.5;   // Interval in seconds (0.5s for faster testing)
        this.playerKills = 0;       // Track player victories
        this.opponentKills = 0;     // Track opponent victories
        this.gameLoopInterval = null; // Store interval ID for cleanup
    }

    startBattle() {
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval); // Prevent multiple intervals
        }
        this.gameLoop();
    }

    gameLoop() {
        this.gameLoopInterval = setInterval(() => {
            this.fight();
            this.checkVictory();
        }, this.fightInterval * 1000); // Convert seconds to milliseconds
    }

    fight() {
        // Simulate combat with random damage between 0 and 30
        const playerDamage = Math.floor(Math.random() * 31); // 0-30 inclusive
        const opponentDamage = Math.floor(Math.random() * 31);
        this.opponentHP = Math.max(0, this.opponentHP - playerDamage); // Prevent negative HP
        this.playerHP = Math.max(0, this.playerHP - opponentDamage);

        console.log(`Player deals ${playerDamage} damage. Opponent HP: ${this.opponentHP}`);
        console.log(`Opponent deals ${opponentDamage} damage. Player HP: ${this.playerHP}`);
    }

    checkVictory() {
        if (this.opponentHP <= 0 && this.playerHP <= 0) {
            // Rare case: both lose simultaneously
            console.log("TIE! Both combatants have fallen!");
            this.opponentKills += 1;
            this.playerKills += 1;
            this.stopBattle();
        } else if (this.opponentHP <= 0) {
            console.log("VICTORY! Congratulations! You have won the battle!");
            this.playerKills += 1;
            this.stopBattle();
        } else if (this.playerHP <= 0) {
            console.log("DEFEAT! You have lost the battle!");
            this.opponentKills += 1;
            this.stopBattle();
        }
    }

    stopBattle() {
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
            this.gameLoopInterval = null;
            this.displayResult();
        }
    }

    displayResult() {
        console.log(`Final Stats - Player HP: ${this.playerHP}, Opponent HP: ${this.opponentHP}`);
        console.log(`Player Kills: ${this.playerKills}, Opponent Kills: ${this.opponentKills}`);
        // In a React app, this could trigger a state update instead of console logs
    }

    reset() {
        this.playerHP = 300;
        this.opponentHP = 300;
        this.stopBattle();
    }
}

// Example usage (for testing outside React)
const battle = new Battle();
battle.startBattle();