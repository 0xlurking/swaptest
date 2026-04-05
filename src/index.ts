#!/usr/bin/env node
import { Command } from "commander";
import {
  createWallet,
  loadWallet,
  displayWallet,
  getBalance,
  getTokenBalance,
} from "./wallet";
import { getQuote, executeSwap } from "./swap";
import { TOKENS, BASE_CHAIN_ID } from "./config";

const program = new Command();

program
  .name("swapbot")
  .description(
    "EVM bot for BASE chain — create wallets and swap tokens via KyberSwap"
  )
  .version("1.0.0");

// ── start ─────────────────────────────────────────────────────────────────────
program
  .command("start")
  .description("Start the bot: show wallet status and available commands")
  .action(async () => {
    console.log("\n╔══════════════════════════════════════╗");
    console.log("║        swapbot — BASE Chain Bot      ║");
    console.log("╚══════════════════════════════════════╝\n");

    let wallet;
    try {
      wallet = loadWallet();
    } catch {
      console.log("⚠️  No wallet found.\n");
      console.log("To get started, create a wallet first:\n");
      console.log("  node dist/index.js create-wallet\n");
      console.log("Then fund it with ETH on BASE and run:\n");
      console.log("  node dist/index.js start\n");
      return;
    }

    console.log(`✅ Bot running on BASE (chain ${BASE_CHAIN_ID})\n`);
    displayWallet(wallet, false);

    console.log("Fetching balances...\n");
    try {
      const ethBalance = await getBalance(wallet.address);
      const tokenSymbols = Object.keys(TOKENS).filter((k) => k !== "ETH");
      console.log("=== Balances ===");
      console.log(`ETH    : ${ethBalance} ETH`);

      for (const symbol of tokenSymbols) {
        const token = TOKENS[symbol];
        try {
          const bal = await getTokenBalance(wallet.address, token.address, token.decimals);
          console.log(`${symbol.padEnd(6)}: ${bal} ${symbol}`);
        } catch {
          console.log(`${symbol.padEnd(6)}: (error fetching balance)`);
        }
      }
      console.log("================\n");
    } catch {
      console.log("⚠️  Could not fetch balances (check your RPC connection).\n");
    }

    console.log("Available commands:");
    console.log("  balance                          — show balances");
    console.log("  quote --from ETH --to USDC --amount 0.01  — get swap quote");
    console.log("  swap  --from ETH --to USDC --amount 0.01  — execute swap");
    console.log("  tokens                           — list supported tokens\n");
  });

// ── create-wallet ────────────────────────────────────────────────────────────
program
  .command("create-wallet")
  .description("Generate a new wallet (address + private key) and save it to wallet.json")
  .option("--overwrite", "Overwrite existing wallet.json", false)
  .option("--show-key", "Display the private key in output", false)
  .action((opts: { overwrite: boolean; showKey: boolean }) => {
    try {
      const wallet = createWallet(opts.overwrite);
      console.log("✅ Wallet created successfully!");
      displayWallet(wallet, opts.showKey);
      if (!opts.showKey) {
        console.log(
          "⚠️  Keep your wallet.json safe. It contains your private key!\n"
        );
      }
    } catch (err) {
      console.error("❌ Error:", (err as Error).message);
      process.exit(1);
    }
  });

// ── balance ───────────────────────────────────────────────────────────────────
program
  .command("balance")
  .description("Show ETH and token balances of your wallet on BASE")
  .option("--token <symbol>", "Token symbol to check (e.g. USDC, WETH)")
  .action(async (opts: { token?: string }) => {
    try {
      const wallet = loadWallet();
      console.log(`\n=== Balances on BASE (chain ${BASE_CHAIN_ID}) ===`);
      console.log(`Wallet: ${wallet.address}`);

      // ETH balance
      const ethBalance = await getBalance(wallet.address);
      console.log(`ETH    : ${ethBalance} ETH`);

      // Specific token or all known tokens
      const tokensToCheck = opts.token
        ? [opts.token.toUpperCase()]
        : Object.keys(TOKENS).filter((k) => k !== "ETH");

      for (const symbol of tokensToCheck) {
        const token = TOKENS[symbol];
        if (!token) {
          console.log(`${symbol}: unknown token`);
          continue;
        }
        if (symbol === "ETH") continue;
        try {
          const bal = await getTokenBalance(
            wallet.address,
            token.address,
            token.decimals
          );
          console.log(`${symbol.padEnd(6)}: ${bal} ${symbol}`);
        } catch {
          console.log(`${symbol.padEnd(6)}: (error fetching balance)`);
        }
      }
      console.log("================================================\n");
    } catch (err) {
      console.error("❌ Error:", (err as Error).message);
      process.exit(1);
    }
  });

// ── quote ────────────────────────────────────────────────────────────────────
program
  .command("quote")
  .description("Get a swap quote from KyberSwap without executing")
  .requiredOption("--from <token>", "Token to swap from (symbol or address)")
  .requiredOption("--to <token>", "Token to swap to (symbol or address)")
  .requiredOption("--amount <amount>", "Amount to swap (human-readable, e.g. 0.01)")
  .option("--slippage <bps>", "Slippage tolerance in bps (default: 50 = 0.5%)", "50")
  .action(async (opts: { from: string; to: string; amount: string; slippage: string }) => {
    try {
      const tokenIn = resolveToken(opts.from);
      const tokenOut = resolveToken(opts.to);

      console.log(`\nFetching quote: ${opts.amount} ${opts.from.toUpperCase()} → ${opts.to.toUpperCase()}`);
      console.log("Please wait...\n");

      const quote = await getQuote({
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        amountIn: opts.amount,
        decimalsIn: tokenIn.decimals,
        decimalsOut: tokenOut.decimals,
        slippage: parseInt(opts.slippage, 10),
      });

      console.log("=== Quote ===");
      console.log(`Amount In  : ${opts.amount} ${opts.from.toUpperCase()}`);
      console.log(`Amount Out : ${quote.amountOut} ${opts.to.toUpperCase()}`);
      console.log(`Price Impact: ${quote.priceImpact}`);
      console.log(`Gas Estimate: ${quote.gas}`);
      console.log(`Router     : ${quote.routerAddress}`);
      console.log("=============\n");
    } catch (err) {
      console.error("❌ Error:", (err as Error).message);
      process.exit(1);
    }
  });

// ── swap ─────────────────────────────────────────────────────────────────────
program
  .command("swap")
  .description("Swap tokens on BASE via KyberSwap aggregator")
  .requiredOption("--from <token>", "Token to swap from (symbol or address)")
  .requiredOption("--to <token>", "Token to swap to (symbol or address)")
  .requiredOption("--amount <amount>", "Amount to swap (human-readable, e.g. 0.01)")
  .option("--slippage <bps>", "Slippage tolerance in bps (default: 50 = 0.5%)", "50")
  .option("--yes", "Skip confirmation prompt", false)
  .action(
    async (opts: {
      from: string;
      to: string;
      amount: string;
      slippage: string;
      yes: boolean;
    }) => {
      try {
        const wallet = loadWallet();
        const tokenIn = resolveToken(opts.from);
        const tokenOut = resolveToken(opts.to);
        const slippage = parseInt(opts.slippage, 10);

        console.log(`\nFetching quote: ${opts.amount} ${opts.from.toUpperCase()} → ${opts.to.toUpperCase()}`);
        console.log("Please wait...\n");

        const quoteParams = {
          tokenIn: tokenIn.address,
          tokenOut: tokenOut.address,
          amountIn: opts.amount,
          decimalsIn: tokenIn.decimals,
          decimalsOut: tokenOut.decimals,
          slippage,
        };

        const quote = await getQuote(quoteParams);

        console.log("=== Swap Details ===");
        console.log(`Wallet     : ${wallet.address}`);
        console.log(`Amount In  : ${opts.amount} ${opts.from.toUpperCase()}`);
        console.log(`Amount Out : ~${quote.amountOut} ${opts.to.toUpperCase()}`);
        console.log(`Price Impact: ${quote.priceImpact}`);
        console.log(`Slippage   : ${slippage / 100}%`);
        console.log(`Gas Estimate: ${quote.gas}`);
        console.log(`Router     : ${quote.routerAddress}`);
        console.log("====================\n");

        if (!opts.yes) {
          const confirmed = await confirm("Proceed with swap? (y/N): ");
          if (!confirmed) {
            console.log("Swap cancelled.");
            return;
          }
        }

        console.log("Executing swap...");
        const txHash = await executeSwap(wallet, quoteParams, quote);
        console.log(`\n✅ Swap submitted!`);
        console.log(`TX Hash: ${txHash}`);
        console.log(`View on BaseScan: https://basescan.org/tx/${txHash}\n`);
      } catch (err) {
        console.error("❌ Error:", (err as Error).message);
        process.exit(1);
      }
    }
  );

// ── tokens ───────────────────────────────────────────────────────────────────
program
  .command("tokens")
  .description("List supported tokens on BASE")
  .action(() => {
    console.log("\n=== Supported Tokens on BASE ===");
    for (const [symbol, info] of Object.entries(TOKENS)) {
      console.log(`${symbol.padEnd(8)} ${info.address}  (${info.decimals} decimals)`);
    }
    console.log("================================\n");
  });

// ── wallet-info ───────────────────────────────────────────────────────────────
program
  .command("wallet-info")
  .description("Show info about the current wallet")
  .option("--show-key", "Display the private key in output", false)
  .action((opts: { showKey: boolean }) => {
    try {
      const wallet = loadWallet();
      displayWallet(wallet, opts.showKey);
    } catch (err) {
      console.error("❌ Error:", (err as Error).message);
      process.exit(1);
    }
  });

// ── helpers ───────────────────────────────────────────────────────────────────

function resolveToken(input: string): {
  address: string;
  decimals: number;
  symbol: string;
} {
  const upper = input.toUpperCase();
  if (TOKENS[upper]) {
    return TOKENS[upper];
  }
  // Treat as raw address — assume 18 decimals
  if (/^0x[0-9a-fA-F]{40}$/.test(input)) {
    return { address: input, decimals: 18, symbol: input.slice(0, 8) };
  }
  throw new Error(
    `Unknown token: "${input}". Use a known symbol (${Object.keys(TOKENS).join(", ")}) or a 0x address.`
  );
}

function confirm(prompt: string): Promise<boolean> {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (data: Buffer | string) => {
      const answer = data.toString().trim().toLowerCase();
      resolve(answer === "y" || answer === "yes");
      process.stdin.pause();
    });
  });
}

program.parse(process.argv);
