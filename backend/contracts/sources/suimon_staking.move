module suimon_game::staking {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use std::option::{Self, Option};
    use std::string::{Self, String};

    // Custom errors
    const EInvalidStakeAmount: u64 = 0;
    const EGameAlreadyStarted: u64 = 1;
    const EGameNotStarted: u64 = 2;
    const EInvalidPlayer: u64 = 3;
    const EGameAlreadyFinished: u64 = 4;
    const EInsufficientBalance: u64 = 5;

    // Game status
    const GAME_STATUS_CREATED: u8 = 0;
    const GAME_STATUS_STARTED: u8 = 1;
    const GAME_STATUS_FINISHED: u8 = 2;

    // Fee percentage (10%)
    const FEE_PERCENTAGE: u64 = 10;
    
    // Team wallet address for receiving fees
    const TEAM_WALLET: address = @0x975109d5f34edee5556a431d3e4658bb7007389519c415d86c10c63a286ebf2b;

    struct GameRoom has key {
        id: UID,
        room_id: String,
        creator: address,
        creator_name: String,
        opponent: Option<address>,
        opponent_name: Option<String>,
        stake_amount: u64,
        status: u8,
        winner: Option<address>,
        balance: Balance<SUI>,
        token_type: bool, // false for SUI, true for SUIMON
        created_at: u64,
    }

    struct StakingTreasury has key {
        id: UID,
        balance: Balance<SUI>,
    }

    // Initialize the staking treasury
    fun init(ctx: &mut TxContext) {
        let treasury = StakingTreasury {
            id: object::new(ctx),
            balance: balance::zero(),
        };
        transfer::share_object(treasury);
    }

    // Create a new game room with stake
    public entry fun create_game_room(
        stake: Coin<SUI>,
        token_type: bool,
        room_id: vector<u8>,
        creator_name: vector<u8>,
        ctx: &mut TxContext
    ) {
        let stake_amount = coin::value(&stake);
        assert!(stake_amount > 0, EInvalidStakeAmount);

        let game_room = GameRoom {
            id: object::new(ctx),
            room_id: string::utf8(room_id),
            creator: tx_context::sender(ctx),
            creator_name: string::utf8(creator_name),
            opponent: option::none(),
            opponent_name: option::none(),
            stake_amount,
            status: GAME_STATUS_CREATED,
            winner: option::none(),
            balance: coin::into_balance(stake),
            token_type,
            created_at: tx_context::epoch(ctx),
        };

        transfer::share_object(game_room);
    }

    // Join an existing game room
    public entry fun join_game_room(
        game_room: &mut GameRoom,
        stake: Coin<SUI>,
        opponent_name: vector<u8>,
        ctx: &mut TxContext
    ) {
        assert!(game_room.status == GAME_STATUS_CREATED, EGameAlreadyStarted);
        let stake_amount = coin::value(&stake);
        assert!(stake_amount == game_room.stake_amount, EInvalidStakeAmount);

        balance::join(&mut game_room.balance, coin::into_balance(stake));
        option::fill(&mut game_room.opponent, tx_context::sender(ctx));
        option::fill(&mut game_room.opponent_name, string::utf8(opponent_name));
        game_room.status = GAME_STATUS_STARTED;
    }

    // Declare winner and distribute rewards
    public entry fun declare_winner(
        game_room: &mut GameRoom,
        treasury: &mut StakingTreasury,
        winner_address: address,
        ctx: &mut TxContext
    ) {
        assert!(game_room.status == GAME_STATUS_STARTED, EGameNotStarted);
        assert!(
            winner_address == game_room.creator || 
            winner_address == *option::borrow(&game_room.opponent),
            EInvalidPlayer
        );

        let total_stake = balance::value(&game_room.balance);
        let fee_amount = (total_stake * FEE_PERCENTAGE) / 100;
        let winner_amount = total_stake - fee_amount;

        // Transfer fee to treasury
        let fee_coin = coin::from_balance(
            balance::split(&mut game_room.balance, fee_amount),
            ctx
        );
        balance::join(&mut treasury.balance, coin::into_balance(fee_coin));

        // Transfer winnings to winner
        let winner_coin = coin::from_balance(
            balance::split(&mut game_room.balance, winner_amount),
            ctx
        );
        transfer::public_transfer(winner_coin, winner_address);

        game_room.status = GAME_STATUS_FINISHED;
        option::fill(&mut game_room.winner, winner_address);
    }

    // Distribute treasury fees to team wallet
    public entry fun distribute_fees(
        treasury: &mut StakingTreasury,
        amount: u64,
        ctx: &mut TxContext
    ) {
        let treasury_balance = balance::value(&treasury.balance);
        assert!(treasury_balance >= amount, EInsufficientBalance);
        
        let fee_coin = coin::from_balance(
            balance::split(&mut treasury.balance, amount),
            ctx
        );
        
        transfer::public_transfer(fee_coin, TEAM_WALLET);
    }

    // View functions
    public fun get_game_status(game_room: &GameRoom): u8 { game_room.status }
    public fun get_stake_amount(game_room: &GameRoom): u64 { game_room.stake_amount }
    public fun get_creator(game_room: &GameRoom): address { game_room.creator }
    public fun get_opponent(game_room: &GameRoom): Option<address> { game_room.opponent }
    public fun get_winner(game_room: &GameRoom): Option<address> { game_room.winner }
    public fun get_token_type(game_room: &GameRoom): bool { game_room.token_type }
    public fun get_room_id(game_room: &GameRoom): &String { &game_room.room_id }
    public fun get_creator_name(game_room: &GameRoom): &String { &game_room.creator_name }
    public fun get_opponent_name(game_room: &GameRoom): &Option<String> { &game_room.opponent_name }
    public fun get_created_at(game_room: &GameRoom): u64 { game_room.created_at }
    public fun get_treasury_balance(treasury: &StakingTreasury): u64 { balance::value(&treasury.balance) }
}