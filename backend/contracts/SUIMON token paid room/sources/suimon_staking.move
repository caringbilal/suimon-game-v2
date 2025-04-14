module suimon_token_paid_room::suimon_staking {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::event;
    use std::option::{Self, Option};

    // Type for our SUIMON token
    use suimon_token::suimon_token::SUIMON_TOKEN;

    // Constants
    const PLATFORM_FEE_PERCENTAGE: u64 = 10; // 10% platform fee

    // Error codes
    const ERR_GAME_ALREADY_STARTED: u64 = 1;
    const ERR_GAME_NOT_STARTED: u64 = 2;
    const ERR_INVALID_PLAYER: u64 = 3;
    const ERR_GAME_ALREADY_FINISHED: u64 = 4;
    const ERR_INSUFFICIENT_STAKE: u64 = 5;

    // Game room status
    const GAME_STATUS_CREATED: u8 = 0;
    const GAME_STATUS_STARTED: u8 = 1;
    const GAME_STATUS_FINISHED: u8 = 2;

    // Events
    struct GameRoomCreated has copy, drop {
        game_id: ID,
        creator: address,
        stake_amount: u64
    }

    struct GameRoomJoined has copy, drop {
        game_id: ID,
        opponent: address
    }

    struct GameFinished has copy, drop {
        game_id: ID,
        winner: address,
        reward_amount: u64
    }

    // Game room object to store game state and stakes
    struct GameRoom has key {
        id: UID,
        creator: address,
        creator_stake: Balance<SUIMON_TOKEN>,
        opponent: Option<address>,
        opponent_stake: Option<Balance<SUIMON_TOKEN>>,
        stake_amount: u64,
        status: u8,
        winner: Option<address>
    }

    // Create a new game room with SUIMON token stake
    public entry fun create_game(
        stake: Coin<SUIMON_TOKEN>,
        ctx: &mut TxContext
    ) {
        let stake_amount = coin::value(&stake);
        assert!(stake_amount > 0, ERR_INSUFFICIENT_STAKE);

        let game_room = GameRoom {
            id: object::new(ctx),
            creator: tx_context::sender(ctx),
            creator_stake: coin::into_balance(stake),
            opponent: option::none(),
            opponent_stake: option::none(),
            stake_amount,
            status: GAME_STATUS_CREATED,
            winner: option::none()
        };

        event::emit(GameRoomCreated {
            game_id: object::uid_to_inner(&game_room.id),
            creator: tx_context::sender(ctx),
            stake_amount
        });

        transfer::share_object(game_room);
    }

    // Join an existing game room
    public entry fun join_game(
        game: &mut GameRoom,
        stake: Coin<SUIMON_TOKEN>,
        ctx: &mut TxContext
    ) {
        assert!(game.status == GAME_STATUS_CREATED, ERR_GAME_ALREADY_STARTED);
        assert!(coin::value(&stake) == game.stake_amount, ERR_INSUFFICIENT_STAKE);

        let opponent = tx_context::sender(ctx);
        assert!(opponent != game.creator, ERR_INVALID_PLAYER);

        option::fill(&mut game.opponent, opponent);
        option::fill(&mut game.opponent_stake, coin::into_balance(stake));
        game.status = GAME_STATUS_STARTED;

        event::emit(GameRoomJoined {
            game_id: object::uid_to_inner(&game.id),
            opponent
        });
    }

    // Finish the game and distribute rewards
    public entry fun finish_game(
        game: &mut GameRoom,
        winner_address: address,
        team_wallet: address,
        ctx: &mut TxContext
    ) {
        assert!(game.status == GAME_STATUS_STARTED, ERR_GAME_NOT_STARTED);
        let opponent = *option::borrow(&game.opponent);
        assert!(winner_address == game.creator || winner_address == opponent, ERR_INVALID_PLAYER);

        // Calculate rewards
        let total_stake = game.stake_amount * 2;
        let platform_fee = (total_stake * PLATFORM_FEE_PERCENTAGE) / 100;
        let winner_reward = total_stake - platform_fee;

        // Create coins for winner and platform
        let winner_coin = coin::from_balance(
            balance::split(&mut game.creator_stake, winner_reward),
            ctx
        );
        let platform_coin = coin::from_balance(
            balance::split(&mut game.creator_stake, platform_fee),
            ctx
        );

        // Transfer rewards
        transfer::public_transfer(winner_coin, winner_address);
        transfer::public_transfer(platform_coin, team_wallet);

        // Update game status
        game.status = GAME_STATUS_FINISHED;
        option::fill(&mut game.winner, winner_address);

        event::emit(GameFinished {
            game_id: object::uid_to_inner(&game.id),
            winner: winner_address,
            reward_amount: winner_reward
        });
    }

    // Getters for game room information
    public fun get_game_status(game: &GameRoom): u8 { game.status }
    public fun get_stake_amount(game: &GameRoom): u64 { game.stake_amount }
    public fun get_creator(game: &GameRoom): address { game.creator }
    public fun get_opponent(game: &GameRoom): Option<address> { game.opponent }
    public fun get_winner(game: &GameRoom): Option<address> { game.winner }
}