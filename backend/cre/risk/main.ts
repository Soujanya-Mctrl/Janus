import { bytesToHex, cre, encodeCallMsg, getNetwork, LAST_FINALIZED_BLOCK_NUMBER, Runner, consensusIdenticalAggregation, type HTTPSendRequester, type Runtime, ok, text } from '@chainlink/cre-sdk';
import { decodeFunctionResult, encodeFunctionData, erc20Abi, isAddress, zeroAddress, type Address } from 'viem';

type Config = { schedule: string; riskApiUrl: string; chainName: string; tokenAddress: string; ownerAddress: string; operatingCost: string };
type Risk = { schema: string; simulated: boolean; availableCash: string; realizedTradingProfit: string; operatingCostsPaid: string };
const canonicalAmount = (value: unknown): bigint => {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) throw new Error('Invalid unsigned risk amount');
  return BigInt(value);
};
const fetchRisk = (requester: HTTPSendRequester, url: string): string => {
  const response = requester.sendRequest({ url, method: 'GET' }).result();
  if (!ok(response)) throw new Error('Risk API request failed');
  const value = JSON.parse(text(response)) as Risk;
  if (value.schema !== 'janus.synthetic-risk/1' || value.simulated !== true) throw new Error('Expected explicitly synthetic risk input');
  canonicalAmount(value.availableCash); canonicalAmount(value.operatingCostsPaid);
  if (typeof value.realizedTradingProfit !== 'string' || !/^-?(0|[1-9][0-9]*)$/.test(value.realizedTradingProfit)) throw new Error('Invalid realized PnL');
  return JSON.stringify(value);
};
const onCron = (runtime: Runtime<Config>) => {
  const config = runtime.config;
  if (!isAddress(config.tokenAddress) || !isAddress(config.ownerAddress)
    || config.tokenAddress === zeroAddress || config.ownerAddress === zeroAddress) throw new Error('Configure nonzero Sepolia token and owner addresses');
  const network = getNetwork({ chainFamily: 'evm', chainSelectorName: config.chainName, isTestnet: true });
  if (!network) throw new Error('Unsupported test network');
  const risk = JSON.parse(new cre.capabilities.HTTPClient().sendRequest(runtime, fetchRisk, consensusIdenticalAggregation<string>())(config.riskApiUrl).result()) as Risk;
  const evm = new cre.capabilities.EVMClient(network.chainSelector.selector);
  const result = evm.callContract(runtime, { call: encodeCallMsg({ from: zeroAddress, to: config.tokenAddress as Address,
    data: encodeFunctionData({ abi: erc20Abi, functionName: 'balanceOf', args: [config.ownerAddress as Address] }) }), blockNumber: LAST_FINALIZED_BLOCK_NUMBER }).result();
  const balance = decodeFunctionResult({ abi: erc20Abi, functionName: 'balanceOf', data: bytesToHex(result.data) });
  const cost = canonicalAmount(config.operatingCost), netProfit = BigInt(risk.realizedTradingProfit) - canonicalAmount(risk.operatingCostsPaid);
  const report = { schema: 'janus.cre-risk/1', paperOnly: true, allowSimulatedOperatingCost: cost > 0n && netProfit >= cost && canonicalAmount(risk.availableCash) >= cost && balance >= cost,
    onchainBalance: balance.toString(), netRealizedPaperProfit: netProfit.toString(), requestedCost: cost.toString(),
    note: 'Advisory paper policy only. This report neither transfers funds nor authorizes real provider spending.' };
  runtime.log(JSON.stringify(report));
  return report;
};
export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(config => [cre.handler(new cre.capabilities.CronCapability().trigger({ schedule: config.schedule }), onCron)]);
}
