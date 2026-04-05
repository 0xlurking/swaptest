# swaptest — EVM Bot for BASE Chain

A TypeScript CLI bot that creates wallets and swaps tokens on the **BASE** network (chain ID `8453`) via the [KyberSwap Aggregator](https://docs.kyberswap.com/).

Built with [viem](https://viem.sh/) for type-safe EVM interactions.

---

## Features

- 🔑 **Wallet Generation** — Create a new EVM wallet (address + private key), saved to `wallet.json`
- 💰 **Balance Checking** — Query ETH and ERC-20 token balances on BASE
- 📊 **Swap Quotes** — Get swap quotes from KyberSwap aggregator without executing
- 🔄 **Token Swaps** — Execute on-chain swaps via KyberSwap with automatic ERC-20 approval handling
- 🪙 **Token Registry** — Built-in registry of popular BASE tokens
- 🔒 **Security** — Private keys masked by default, `wallet.json` saved with restricted permissions

---

## Project Structure

```
swaptest/
├── src/
│   ├── index.ts      # CLI entry point (commander commands)
│   ├── config.ts     # Chain config, token registry, env variables
│   ├── wallet.ts     # Wallet creation, loading, balance queries
│   └── swap.ts       # KyberSwap aggregator integration (quote + swap)
├── dist/             # Compiled JavaScript output (gitignored)
├── .env.example      # Environment variable template
├── .gitignore
├── tsconfig.json
└── package.json
```

---

## Requirements

- **Node.js** ≥ 18
- **npm**

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy the example env file
cp .env.example .env

# 3. Build the TypeScript source
npm run build

# 4. Create a wallet
node dist/index.js create-wallet --show-key

# 5. Fund the wallet with ETH on BASE

# 6. Swap tokens
node dist/index.js swap --from ETH --to USDC --amount 0.01
```

---

## CLI Commands

### `create-wallet`

Generate a new wallet and save it to `wallet.json`.

```bash
node dist/index.js create-wallet

# Show the private key in output
node dist/index.js create-wallet --show-key

# Overwrite an existing wallet.json
node dist/index.js create-wallet --overwrite
```

| Option        | Description                          |
|---------------|--------------------------------------|
| `--show-key`  | Display the private key in output    |
| `--overwrite` | Overwrite existing `wallet.json`     |

---

### `wallet-info`

Show info about the currently loaded wallet.

```bash
node dist/index.js wallet-info

# Reveal the private key
node dist/index.js wallet-info --show-key
```

---

### `balance`

Show ETH and ERC-20 token balances on BASE.

```bash
# All supported tokens
node dist/index.js balance

# Single token
node dist/index.js balance --token USDC
```

| Option           | Description                              |
|------------------|------------------------------------------|
| `--token <SYM>`  | Check only a specific token (e.g. USDC)  |

---

### `tokens`

List all supported token symbols, addresses, and decimals.

```bash
node dist/index.js tokens
```

---

### `quote`

Get a swap quote from KyberSwap (no transaction sent).

```bash
node dist/index.js quote --from ETH --to USDC --amount 0.01

# Custom slippage (in bps, default 50 = 0.5%)
node dist/index.js quote --from ETH --to USDC --amount 0.01 --slippage 100
```

| Option              | Description                                    |
|---------------------|------------------------------------------------|
| `--from <token>`    | **(required)** Token to swap from              |
| `--to <token>`      | **(required)** Token to swap to                |
| `--amount <amount>` | **(required)** Amount (human-readable)          |
| `--slippage <bps>`  | Slippage tolerance in bps (default: `50` = 0.5%) |

---

### `swap`

Execute a token swap on BASE via KyberSwap.

```bash
node dist/index.js swap --from ETH --to USDC --amount 0.01

# Skip confirmation prompt
node dist/index.js swap --from ETH --to USDC --amount 0.01 --yes

# Custom slippage
node dist/index.js swap --from ETH --to USDC --amount 0.01 --slippage 100
```

| Option              | Description                                    |
|---------------------|------------------------------------------------|
| `--from <token>`    | **(required)** Token to swap from              |
| `--to <token>`      | **(required)** Token to swap to                |
| `--amount <amount>` | **(required)** Amount (human-readable)          |
| `--slippage <bps>`  | Slippage tolerance in bps (default: `50` = 0.5%) |
| `--yes`             | Skip the confirmation prompt                   |

---

## Supported Tokens

| Symbol | Address                                      | Decimals |
|--------|----------------------------------------------|----------|
| ETH    | `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` | 18       |
| WETH   | `0x4200000000000000000000000000000000000006`   | 18       |
| USDC   | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | 6        |
| USDT   | `0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2` | 6        |
| DAI    | `0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb` | 18       |
| CBETH  | `0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22` | 18       |

You can also pass any raw `0x...` token contract address to `--from` or `--to` (defaults to 18 decimals).

---

## Configuration

Create a `.env` file (or copy from `.env.example`):

```bash
cp .env.example .env
```

| Variable              | Default                      | Description                                     |
|-----------------------|------------------------------|-------------------------------------------------|
| `BASE_RPC_URL`        | `https://mainnet.base.org`   | BASE chain RPC endpoint                         |
| `PRIVATE_KEY`         | *(reads `wallet.json`)*      | Load wallet from env var instead of file         |
| `KYBERSWAP_CLIENT_ID` | `swaptest-bot`               | Client identifier sent to KyberSwap API         |

---

## How It Works

1. **Wallet** — `create-wallet` generates a random private key using viem's `generatePrivateKey()`, derives the address, and saves both to `wallet.json` with `chmod 600`.

2. **Quote** — Calls the KyberSwap Aggregator API (`/routes` → `/route/build`) to find the best swap route across DEX pools on BASE.

3. **Swap** — Fetches a fresh route, checks and sets ERC-20 approval if needed, then sends the swap transaction via the KyberSwap router contract. For native ETH swaps, approval is skipped and the value is sent directly.

4. **Balance** — Uses viem's `getBalance` for ETH and `readContract` with the ERC-20 `balanceOf` ABI for token balances.

---

## Security

- `wallet.json` is saved with file mode `0o600` (owner-readable only)
- `wallet.json` and `.env` are listed in `.gitignore` — **never commit them**
- The private key is masked by default in all CLI output (use `--show-key` to reveal)
- Wallet can be loaded from `PRIVATE_KEY` env var instead of the file

---

## Development

```bash
# Run directly with ts-node (no build step needed)
npm run dev -- create-wallet
npm run dev -- tokens
npm run dev -- quote --from ETH --to USDC --amount 0.01

# Build to dist/
npm run build

# Run built version
node dist/index.js --help
```

---

## Dependencies

| Package     | Purpose                                      |
|-------------|----------------------------------------------|
| [viem](https://viem.sh/) | Type-safe EVM client (wallets, contracts, transactions) |
| [axios](https://axios-http.com/) | HTTP client for KyberSwap API calls |
| [commander](https://github.com/tj/commander.js) | CLI command parsing |
| [dotenv](https://github.com/motdotla/dotenv) | Environment variable loading from `.env` |

---

## License

ISC


