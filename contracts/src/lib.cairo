use starknet::ContractAddress;

#[starknet::interface]
pub trait IERC20<TState> {
    fn name(self: @TState) -> felt252;
    fn symbol(self: @TState) -> felt252;
    fn decimals(self: @TState) -> u8;
    fn total_supply(self: @TState) -> u256;
    fn balance_of(self: @TState, account: ContractAddress) -> u256;
    fn allowance(self: @TState, owner: ContractAddress, spender: ContractAddress) -> u256;
    fn transfer(ref self: TState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: TState, sender: ContractAddress, recipient: ContractAddress, amount: u256
    ) -> bool;
    fn approve(ref self: TState, spender: ContractAddress, amount: u256) -> bool;
}

#[starknet::interface]
pub trait IShieldLink<TContractState> {
    fn deposit(
        ref self: TContractState,
        token: ContractAddress,
        amount: u256,
        commitment: felt252
    );
    fn claim(
        ref self: TContractState,
        recipient: ContractAddress,
        commitment: felt252,
        r: felt252,
        s: felt252
    );
    fn is_commitment_active(self: @TContractState, commitment: felt252) -> bool;
}

#[starknet::contract]
pub mod ShieldLink {
    use super::IERC20Dispatcher;
    use super::IERC20DispatcherTrait;
    use starknet::ContractAddress;
    use starknet::get_caller_address;
    use starknet::get_contract_address;
    use core::ecdsa::check_ecdsa_signature;
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};

    #[storage]
    struct Storage {
        commitments_token: Map<felt252, ContractAddress>,
        commitments_amount: Map<felt252, u256>,
        commitments_active: Map<felt252, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Deposit: Deposit,
        Claim: Claim,
    }

    #[derive(Drop, starknet::Event)]
    struct Deposit {
        #[key]
        commitment: felt252,
        token: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Claim {
        #[key]
        commitment: felt252,
        recipient: ContractAddress,
        amount: u256,
    }

    #[abi(embed_v0)]
    impl ShieldLinkImpl of super::IShieldLink<ContractState> {
        fn deposit(
            ref self: ContractState,
            token: ContractAddress,
            amount: u256,
            commitment: felt252
        ) {
            // Check that commitment is not already used
            let active = self.commitments_active.read(commitment);
            assert(!active, 'Commitment already exists');
            assert(amount > 0, 'Amount must be positive');

            // Transfer tokens from sender to contract
            let caller = get_caller_address();
            let contract_address = get_contract_address();
            let token_dispatcher = IERC20Dispatcher { contract_address: token };
            
            // Execute transfer_from
            let success = token_dispatcher.transfer_from(caller, contract_address, amount);
            assert(success, 'Token transfer failed');

            // Record commitment
            self.commitments_token.write(commitment, token);
            self.commitments_amount.write(commitment, amount);
            self.commitments_active.write(commitment, true);

            // Emit event
            self.emit(Deposit { commitment, token, amount });
        }

        fn claim(
            ref self: ContractState,
            recipient: ContractAddress,
            commitment: felt252,
            r: felt252,
            s: felt252
        ) {
            // Verify commitment is active
            let active = self.commitments_active.read(commitment);
            assert(active, 'Commitment not active');

            let token = self.commitments_token.read(commitment);
            let amount = self.commitments_amount.read(commitment);

            // Verify signature: the commitment is the public key!
            // We verify that the signature (r, s) over the recipient address (hash) is valid for public key `commitment`.
            let recipient_felt: felt252 = recipient.into();
            
            // check_ecdsa_signature returns bool
            let is_valid = check_ecdsa_signature(recipient_felt, commitment, r, s);
            assert(is_valid, 'Invalid signature');

            // Deactivate commitment to prevent double spend
            self.commitments_active.write(commitment, false);
            self.commitments_amount.write(commitment, 0);

            // Transfer tokens to recipient
            let token_dispatcher = IERC20Dispatcher { contract_address: token };
            let success = token_dispatcher.transfer(recipient, amount);
            assert(success, 'Token claim transfer failed');

            // Emit event
            self.emit(Claim { commitment, recipient, amount });
        }

        fn is_commitment_active(self: @ContractState, commitment: felt252) -> bool {
            self.commitments_active.read(commitment)
        }
    }
}
