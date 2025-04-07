module suimon_game::game {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use std::option::{Self, Option};

    const FEE_PERCENTAGE: u64 = 10;

    const EInvalidStakeAmount: u64 = 0;
    const EGameAlreadyStarted: u64 = 1;
    const EGameNotStarted: u64 = 2;
    const EInvalidPlayer: u64 = 3;

    const GAME_STATUS_CREATED: u8 = 0;
    const GAME_STATUS_STARTED: u8 = 1;
    const GAME_STATUS_FINISHED: u8 = 2;

    struct SuiGame has key {
        id: UID,
        creator: address,
        opponent: Option<address>,
        stake_amount: u64,
        status: u8,
        winner: Option<address>,
        balance: Balance<SUI>,
    }

    struct SuiGameTreasury has key {
        id: UID,
        balance: Balance<SUI>,
    }

    fun init(ctx: &mut TxContext) {
        let treasury = SuiGameTreasury {
            id: object::new(ctx),
            balance: balance::zero(),
        };
        transfer::share_object(treasury);
    }

    public entry fun create_game(stake: Coin<SUI>, ctx: &mut TxContext) {
        let stake_amount = coin::value(&stake);
        assert!(stake_amount > 0, EInvalidStakeAmount);

        let game = SuiGame {
            id: object::new(ctx),
            creator: tx_context::sender(ctx),
            opponent: option::none(),
            stake_amount,
            status: GAME_STATUS_CREATED,
            winner: option::none(),
            balance: coin::into_balance(stake),
        };
        transfer::share_object(game);
    }

    public entry fun join_game(game: &mut SuiGame, stake: Coin<SUI>, ctx: &mut TxContext) {
        assert!(game.status == GAME_STATUS_CREATED, EGameAlreadyStarted);

        let stake_amount = coin::value(&stake);
        assert!(stake_amount == game.stake_amount, EInvalidStakeAmount);

        balance::join(&mut game.balance, coin::into_balance(stake));
        option::fill(&mut game.opponent, tx_context::sender(ctx));
        game.status = GAME_STATUS_STARTED;
    }

    public entry fun declare_winner(game: &mut SuiGame, treasury: &mut SuiGameTreasury, winner_address: address, ctx: &mut TxContext) {
        assert!(game.status == GAME_STATUS_STARTED, EGameNotStarted);

        assert!(
            winner_address == game.creator ||
            winner_address == *option::borrow(&game.opponent),
            EInvalidPlayer
        );

        let total = balance::value(&game.balance);

        let fee = (total * FEE_PERCENTAGE)/100;
        let winner_share = total - fee;

        let fee_coin = coin::from_balance(balance::split(&mut game.balance, fee), ctx);
        balance::join(&mut treasury.balance, coin::into_balance(fee_coin));

        let winner_coin = coin::from_balance(balance::split(&mut game.balance, winner_share), ctx);
        transfer::public_transfer(winner_coin, winner_address);

        game.status = GAME_STATUS_FINISHED;
        option::fill(&mut game.winner, winner_address);
    }

    // View methods...
}