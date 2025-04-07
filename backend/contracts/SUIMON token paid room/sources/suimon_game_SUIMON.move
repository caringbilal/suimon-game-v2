module suimon_game::suimon_staking {
use sui::object::{Self, UID};
use sui::transfer;
use sui::tx_context::{Self, TxContext};
use sui::coin::{Self, Coin};
use sui::balance::{Self, Balance};
use std::option::{Self, Option};
use std::string::{Self, String};

// Placeholder type for SUIMON coin
struct SUIMON has drop {}

const FEE_PERCENTAGE: u64 = 10;

const EInvalidStakeAmount: u64 = 0;
const EAlreadyJoined: u64 = 1;
const ENotStarted: u64 = 2;
const EInvalidPlayer: u64 = 3;

const ROOM_STATUS_CREATED: u8 = 0;
const ROOM_STATUS_STARTED: u8 = 1;
const ROOM_STATUS_FINISHED: u8 = 2;

struct SuimonRoom has key {
    id: UID,
    creator: address,
    creator_name: String,
    opponent: Option<address>,
    opponent_name: Option<String>,
    stake_amount: u64,
    status: u8,
    winner: Option<address>,
    balance: Balance<SUIMON>,
    room_id: String,
    created_at: u64,
}

struct SuimonRoomTreasury has key {
    id: UID,
    balance: Balance<SUIMON>,
}

fun init(ctx: &mut TxContext) {
    let treasury = SuimonRoomTreasury {
        id: object::new(ctx),
        balance: balance::zero(),
    };
    transfer::share_object(treasury);
}

public entry fun create_room(
    stake: Coin<SUIMON>,
    room_id: vector<u8>,
    creator_name: vector<u8>,
    ctx: &mut TxContext
) {
    let stake_amount = coin::value(&stake);
    assert!(stake_amount > 0, EInvalidStakeAmount);

    let room = SuimonRoom {
        id: object::new(ctx),
        creator: tx_context::sender(ctx),
        creator_name: string::utf8(creator_name),
        opponent: option::none(),
        opponent_name: option::none(),
        stake_amount,
        status: ROOM_STATUS_CREATED,
        winner: option::none(),
        balance: coin::into_balance(stake),
        room_id: string::utf8(room_id),
        created_at: tx_context::epoch(ctx),
    };

    transfer::share_object(room);
}

public entry fun join_room(
    room: &mut SuimonRoom,
    stake: Coin<SUIMON>,
    opponent_name: vector<u8>,
    ctx: &mut TxContext
) {
    assert!(room.status == ROOM_STATUS_CREATED, EAlreadyJoined);

    let stake_amount = coin::value(&stake);
    assert!(stake_amount == room.stake_amount, EInvalidStakeAmount);

    balance::join(&mut room.balance, coin::into_balance(stake));
    option::fill(&mut room.opponent, tx_context::sender(ctx));
    option::fill(&mut room.opponent_name, string::utf8(opponent_name));
    room.status = ROOM_STATUS_STARTED;
}

public entry fun declare_winner(
    room: &mut SuimonRoom,
    treasury: &mut SuimonRoomTreasury,
    winner_address: address,
    ctx: &mut TxContext
) {
    assert!(room.status == ROOM_STATUS_STARTED, ENotStarted);
    assert!(
        winner_address == room.creator ||
        winner_address == *option::borrow(&room.opponent),
        EInvalidPlayer
    );

    let total = balance::value(&room.balance);
    let fee = (total * FEE_PERCENTAGE) / 100;
    let winner_share = total - fee;

    let fee_coin = coin::from_balance(balance::split(&mut room.balance, fee), ctx);
    balance::join(&mut treasury.balance, coin::into_balance(fee_coin));

    let winner_coin = coin::from_balance(balance::split(&mut room.balance, winner_share), ctx);
    transfer::public_transfer(winner_coin, winner_address);

    room.status = ROOM_STATUS_FINISHED;
    option::fill(&mut room.winner, winner_address);
}
}
