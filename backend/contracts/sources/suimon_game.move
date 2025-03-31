module suimon_game::game {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use std::option::{Self, Option};

    // Custom errors
    const EInvalidStakeAmount: u64 = 0;
    const EGameAlreadyStarted: u64 = 1;
    const EGameNotStarted: u64 = 2;
    const EInvalidPlayer: u64 = 3;
    const EGameAlreadyFinished: u64 = 4;

    // Game status
    const GAME_STATUS_CREATED: u8 = 0;
    const GAME_STATUS_STARTED: u8 = 1;
    const GAME_STATUS_FINISHED: u8 = 2;

    // Fee percentage (10%)
    const FEE_PERCENTAGE: u64 = 10;

    struct Game has key {
        id: UID,
        creator: address,
        opponent: Option<address>,
        stake_amount: u64,
        status: u8,
        winner: Option<address>,
        balance: Balance<SUI>,
        token_type: bool, // false for SUI, true for SUIMON
    }

    struct GameTreasury has key {
        id: UID,
        balance: Balance<SUI>,
    }

    // Initialize the game treasury
    fun init(ctx: &mut TxContext) {
        let treasury = GameTreasury {
            id: object::new(ctx),
            balance: balance::zero(),
        };
        transfer::share_object(treasury);
    }

    // Create a new game with stake
    public entry fun create_game(
        stake: Coin<SUI>,
        token_type: bool,
        ctx: &mut TxContext
    ) {
        let stake_amount = coin::value(&stake);
        assert!(stake_amount > 0, EInvalidStakeAmount);

        let game = Game {
            id: object::new(ctx),
            creator: tx_context::sender(ctx),
            opponent: option::none(),
            stake_amount,
            status: GAME_STATUS_CREATED,
            winner: option::none(),
            balance: coin::into_balance(stake),
            token_type,
        };

        transfer::share_object(game);
    }

    // Join an existing game
    public entry fun join_game(
        game: &mut Game,
        stake: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        assert!(game.status == GAME_STATUS_CREATED, EGameAlreadyStarted);
        let stake_amount = coin::value(&stake);
        assert!(stake_amount == game.stake_amount, EInvalidStakeAmount);

        balance::join(&mut game.balance, coin::into_balance(stake));
        option::fill(&mut game.opponent, tx_context::sender(ctx));
        game.status = GAME_STATUS_STARTED;
    }

    // Declare winner and distribute rewards
    public entry fun declare_winner(
        game: &mut Game,
        treasury: &mut GameTreasury,
        winner_address: address,
        ctx: &mut TxContext
    ) {
        assert!(game.status == GAME_STATUS_STARTED, EGameNotStarted);
        assert!(
            winner_address == game.creator || 
            winner_address == *option::borrow(&game.opponent),
            EInvalidPlayer
        );

        let total_stake = balance::value(&game.balance);
        let fee_amount = (total_stake * FEE_PERCENTAGE) / 100;
        let winner_amount = total_stake - fee_amount;

        // Transfer fee to treasury
        let fee_coin = coin::from_balance(
            balance::split(&mut game.balance, fee_amount),
            ctx
        );
        balance::join(&mut treasury.balance, coin::into_balance(fee_coin));

        // Transfer winnings to winner
        let winner_coin = coin::from_balance(
            balance::split(&mut game.balance, winner_amount),
            ctx
        );
        transfer::public_transfer(winner_coin, winner_address);

        game.status = GAME_STATUS_FINISHED;
        option::fill(&mut game.winner, winner_address);
    }

    // View functions
    public fun get_game_status(game: &Game): u8 { game.status }
    public fun get_stake_amount(game: &Game): u64 { game.stake_amount }
    public fun get_creator(game: &Game): address { game.creator }
    public fun get_opponent(game: &Game): Option<address> { game.opponent }
    public fun get_winner(game: &Game): Option<address> { game.winner }
    public fun get_token_type(game: &Game): bool { game.token_type }
}