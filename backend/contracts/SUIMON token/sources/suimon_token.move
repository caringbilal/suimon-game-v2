module suimon_token::suimon_token {
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::tx_context::{TxContext, sender};
    use sui::transfer::{Self, public_transfer};
    use sui::url::{Self};
    use sui::object::{Self, UID};
    use std::option;

    /// One-time witness type for initializing the coin
    struct SUIMON_TOKEN has drop {}

    /// Marker struct for the SUIMON token type
    struct SUIMON has drop {}

    /// Capability to manage the SUIMON token (e.g., for admin operations)
    struct AdminCap has key, store {
        id: UID,
    }

    /// One-time initialization function to set up the coin
    fun init(witness: SUIMON_TOKEN, ctx: &mut TxContext) {
        let (treasury_cap, metadata) = coin::create_currency<SUIMON>(
            witness,
            9, // Decimals (standard for most tokens)
            b"SUIMON", // Symbol
            b"Suimon Token", // Name
            b"A custom token on Sui", // Description
            option::some(url::new_unsafe_from_bytes(b"https://example.com/suimon.png")), // Icon URL (optional)
            ctx
        );

        // Transfer the TreasuryCap to the sender (contract deployer)
        transfer::public_transfer(treasury_cap, sender(ctx));

        // Share the metadata object for public access (required for wallets/explorers)
        transfer::public_share_object(metadata);

        // Create and transfer an AdminCap to the sender for future admin operations
        transfer::transfer(AdminCap { id: object::new(ctx) }, sender(ctx));
    }

    /// Entry function to mint 1_000_000_000 SUIMON tokens to the caller
    public entry fun mint_initial_supply(
        treasury_cap: &mut TreasuryCap<SUIMON>,
        ctx: &mut TxContext
    ) {
        let coin = coin::mint(treasury_cap, 1_000_000_000_000_000_000, ctx); // 1B tokens with 9 decimals
        public_transfer(coin, sender(ctx));
    }

    /// Entry function to mint additional tokens (admin-only, requires AdminCap)
    public entry fun mint_tokens(
        _admin_cap: &AdminCap,
        treasury_cap: &mut TreasuryCap<SUIMON>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let coin = coin::mint(treasury_cap, amount, ctx);
        public_transfer(coin, recipient);
    }

    /// Burn tokens to reduce supply (optional, admin-only)
    public entry fun burn(
        _admin_cap: &AdminCap,
        treasury_cap: &mut TreasuryCap<SUIMON>,
        coin: Coin<SUIMON>
    ) {
        coin::burn(treasury_cap, coin);
    }

    #[test_only]
    /// Test-only init function for local testing
    public fun test_init(ctx: &mut TxContext) {
        init(SUIMON_TOKEN {}, ctx);
    }
}