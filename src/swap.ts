import axios from "axios";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
} from "viem";
import { base } from "viem/chains";
import { BASE_RPC_URL, KYBERSWAP_BASE_URL, KYBERSWAP_CLIENT_ID } from "./config";
import { getAccount, WalletInfo } from "./wallet";

const ERC20_APPROVE_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export interface QuoteParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;    // human-readable amount
  decimalsIn: number;
  decimalsOut: number;
  slippage?: number;   // in bps, e.g. 50 = 0.5%
}

export interface QuoteResult {
  amountOut: string;       // human-readable
  amountOutRaw: string;    // raw bigint string
  routerAddress: string;
  encodedSwapData: string;
  gas: string;
  priceImpact: string;
}

interface RouteBuildResult {
  routerAddress: string;
  calldata: string;
  gas: string;
  amountOut: string;
  priceImpact: string;
}

/**
 * Shared helper: fetch route from KyberSwap and build swap transaction data.
 * @param params    Swap parameters
 * @param sender    Address of the swap sender (use zero address for quotes)
 * @param recipient Address that will receive output tokens
 */
async function fetchRouteAndBuild(
  params: QuoteParams,
  sender: string,
  recipient: string
): Promise<RouteBuildResult> {
  const amountInRaw = parseUnits(params.amountIn, params.decimalsIn).toString();

  const routeRes = await axios.get(`${KYBERSWAP_BASE_URL}/routes`, {
    params: {
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      amountIn: amountInRaw,
      saveGas: false,
      gasInclude: true,
    },
    headers: { "x-client-id": KYBERSWAP_CLIENT_ID },
  });

  const routeData = routeRes.data;
  if (routeData.code !== 0) {
    throw new Error(`KyberSwap route error: ${routeData.message}`);
  }

  const summary = routeData.data.routeSummary as Record<string, unknown>;

  const buildRes = await axios.post(
    `${KYBERSWAP_BASE_URL}/route/build`,
    {
      routeSummary: summary,
      sender,
      recipient,
      slippageTolerance: params.slippage ?? 50,
      deadline: Math.floor(Date.now() / 1000) + 1200,
    },
    { headers: { "x-client-id": KYBERSWAP_CLIENT_ID } }
  );

  const buildData = buildRes.data;
  if (buildData.code !== 0) {
    throw new Error(`KyberSwap build error: ${buildData.message}`);
  }

  const priceImpact =
    summary.priceImpact != null
      ? `${(Number(summary.priceImpact) * 100).toFixed(4)}%`
      : "N/A";

  return {
    routerAddress: buildData.data.routerAddress as string,
    calldata: buildData.data.data as string,
    gas: (buildData.data.gas ?? "N/A") as string,
    amountOut: summary.amountOut as string,
    priceImpact,
  };
}

/**
 * Fetch a swap quote from KyberSwap aggregator.
 */
export async function getQuote(params: QuoteParams): Promise<QuoteResult> {
  const zero = "0x0000000000000000000000000000000000000000";
  const result = await fetchRouteAndBuild(params, zero, zero);

  return {
    amountOut: formatUnits(BigInt(result.amountOut), params.decimalsOut),
    amountOutRaw: result.amountOut,
    routerAddress: result.routerAddress,
    encodedSwapData: result.calldata,
    gas: result.gas,
    priceImpact: result.priceImpact,
  };
}

/**
 * Execute a token swap on BASE chain via KyberSwap.
 */
export async function executeSwap(
  walletInfo: WalletInfo,
  params: QuoteParams,
  _quote: QuoteResult
): Promise<string> {
  const account = getAccount(walletInfo);

  const publicClient = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(BASE_RPC_URL),
  });

  // Fetch a fresh route + build with the real sender/recipient
  const { routerAddress, calldata } = await fetchRouteAndBuild(
    params,
    account.address,
    account.address
  );

  const amountInRaw = parseUnits(params.amountIn, params.decimalsIn).toString();
  const isNativeIn = params.tokenIn.toLowerCase() === NATIVE_TOKEN.toLowerCase();

  // Approve ERC-20 spend allowance if needed
  if (!isNativeIn) {
    const amountInBig = BigInt(amountInRaw);
    const allowance = (await publicClient.readContract({
      address: params.tokenIn as `0x${string}`,
      abi: ERC20_APPROVE_ABI,
      functionName: "allowance",
      args: [account.address, routerAddress as `0x${string}`],
    })) as bigint;

    if (allowance < amountInBig) {
      console.log("  Approving token spend...");
      const approveTx = await walletClient.writeContract({
        address: params.tokenIn as `0x${string}`,
        abi: ERC20_APPROVE_ABI,
        functionName: "approve",
        args: [routerAddress as `0x${string}`, amountInBig],
      });
      console.log(`  Approval tx: ${approveTx}`);
      await publicClient.waitForTransactionReceipt({ hash: approveTx });
      console.log("  Approval confirmed.");
    }
  }

  // Send the swap transaction
  const txHash = await walletClient.sendTransaction({
    to: routerAddress as `0x${string}`,
    data: calldata as `0x${string}`,
    value: isNativeIn ? BigInt(amountInRaw) : 0n,
  });

  return txHash;
}
