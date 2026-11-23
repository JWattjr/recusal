import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const globalModules = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
const sdkRoot = path.join(globalModules, 'genlayer', 'node_modules', 'genlayer-js', 'dist');
const { createClient, createAccount } = await import(pathToFileURL(path.join(sdkRoot, 'index.js')));
const { studionet } = await import(pathToFileURL(path.join(sdkRoot, 'chains', 'index.js')));
const { TransactionStatus, ExecutionResult } = await import(pathToFileURL(path.join(sdkRoot, 'types', 'index.js')));

const contractPath = path.join(root, 'contracts', 'recusal.py');
const contractCode = await readFile(contractPath, 'utf8');
if (!contractCode.startsWith('# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }')) {
  throw new Error('Pinned GenVM runner header check failed; refusing to deploy.');
}
const secretData = JSON.parse(await readFile(path.join(root, '.test-wallets.json'), 'utf8'));
if (secretData.network !== 'studionet' || secretData.chainId !== 61999) {
  throw new Error('The ignored test wallet file is not configured for StudioNet.');
}

const account = createAccount(secretData.accounts.steward.privateKey);
const client = createClient({ chain: studionet, account });
const hash = await client.deployContract({ code: contractCode, args: [], leaderOnly: false });
console.log(`deployment_tx=${hash}`);

const receipt = await client.waitForTransactionReceipt({
  hash,
  status: TransactionStatus.FINALIZED,
  fullTransaction: false,
});
if (receipt.txExecutionResultName !== ExecutionResult.FINISHED_WITH_RETURN) {
  throw new Error(`Deployment finalized with execution result ${receipt.txExecutionResultName || 'unknown'}.`);
}
const contractAddress = receipt.data?.contract_address;
if (!/^0x[0-9a-fA-F]{40}$/.test(contractAddress || '')) {
  throw new Error('Finalized deployment receipt did not include a contract address.');
}
const result = {
  network: 'studionet',
  chainId: 61999,
  contractAddress,
  explorerUrl: `https://explorer-studio.genlayer.com/address/${contractAddress}`,
  deploymentTx: hash,
  status: 'FINALIZED',
  executionOutcome: receipt.txExecutionResultName,
};
await writeFile(path.join(root, '.test-deployment.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result));
