# swaptest — EVM Bot for BASE chain

A TypeScript CLI bot that creates wallets and swaps tokens on the **BASE** network via the [KyberSwap Aggregator](https://docs.kyberswap.com/).

## Features

- 🔑 Generate an EVM wallet (address + private key)
- 💰 Check ETH and ERC-20 token balances on BASE
- 📊 Get swap quotes from KyberSwap without executing
- 🔄 Swap tokens on BASE via KyberSwap aggregator
- 🪙 Lists supported tokens on BASE

## Requirements

- Node.js ≥ 18
- npm

## Setup

```bash
# Install dependencies
npm install

# Copy the example env file
cp .env.example .env

# Build the TypeScript source
npm run build
```

## Commands

### `create-wallet`
Generate a new wallet and save it to `wallet.json`.

```bash
node dist/index.js create-wallet

# Show the private key in output
node dist/index.js create-wallet --show-key

# Overwrite an existing wallet.json
node dist/index.js create-wallet --overwrite
```

### `wallet-info`
Show info about the currently loaded wallet.

```bash
node dist/index.js wallet-info

# Reveal the private key
node dist/index.js wallet-info --show-key
```

### `balance`
Show ETH and ERC-20 token balances on BASE.

```bash
# All supported tokens
node dist/index.js balance

# Single token
node dist/index.js balance --token USDC
```

### `tokens`
List all supported token symbols and addresses.

```bash
node dist/index.js tokens
```

### `quote`
Get a swap quote from KyberSwap (no transaction sent).

```bash
node dist/index.js quote --from ETH --to USDC --amount 0.01

# Custom slippage (in bps, default 50 = 0.5%)
node dist/index.js quote --from ETH --to USDC --amount 0.01 --slippage 100
```

### `swap`
Execute a token swap on BASE via KyberSwap.

```bash
node dist/index.js swap --from ETH --to USDC --amount 0.01

# Skip confirmation prompt
node dist/index.js swap --from ETH --to USDC --amount 0.01 --yes

# Custom slippage
node dist/index.js swap --from ETH --to USDC --amount 0.01 --slippage 100
```

## Supported Tokens

| Symbol | Address | Decimals |
|--------|---------|----------|
| ETH    | 0xEeee...eEEeE | 18 |
| WETH   | 0x4200...0006 | 18 |
| USDC   | 0x8335...913 | 6 |
| USDT   | 0xfde4...bb2 | 6 |
| DAI    | 0x50c5...Cb | 18 |
| CBETH  | 0x2Ae3...22 | 18 |

You can also pass a raw `0x...` token address directly to `--from` / `--to`.

## Configuration

Edit `.env` to configure:

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_RPC_URL` | `https://mainnet.base.org` | BASE RPC endpoint |
| `PRIVATE_KEY` | *(wallet.json)* | Load wallet from env instead of file |
| `KYBERSWAP_CLIENT_ID` | `swaptest-bot` | Client ID sent to KyberSwap |

## Security

- `wallet.json` is saved with `chmod 600` (owner-readable only)
- `wallet.json` and `.env` are in `.gitignore` — **never commit them**
- The private key is masked by default in all output

## Development

```bash
# Run directly with ts-node (no build step)
npm run dev -- create-wallet

# Build
npm run build
```

