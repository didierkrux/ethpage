import {
  createWalletClient,
  custom,
  encodeAbiParameters,
  encodePacked,
  keccak256,
  zeroAddress,
  type Address,
  type Chain,
  type Hex,
} from 'viem'
import { arbitrum, base, mainnet, optimism, sepolia } from 'viem/chains'
import { activeProvider, connectWallet } from './wallets'

// Recommendations are EAS attestations (attest.org): schema
// `string relationship,string recommendation`, recipient = the page's name,
// attester = the recommender's wallet. Reads go through the public easscan
// GraphQL indexer; writes go straight to the EAS contract with viem (the
// eas-sdk is skipped on purpose — it drags in ethers).
export interface RecommendationsConfig {
  chain?: string
  schemaUid: string
}

export interface Recommendation {
  uid: string
  attester: Address
  attesterName: string | null
  time: number
  relationship: string
  recommendation: string
  // Public = the receiver follows the attester on EFP (follow = accept).
  isPublic: boolean
}

// base/optimism use the OP-stack EAS/SchemaRegistry predeploys; the others
// are the canonical deployments from
// github.com/ethereum-attestation-service/eas-contracts.
interface EasChain {
  chain: Chain
  eas: Address
  registry: Address
  easscan: string
}

const CHAINS: Record<string, EasChain> = {
  base: {
    chain: base,
    eas: '0x4200000000000000000000000000000000000021',
    registry: '0x4200000000000000000000000000000000000020',
    easscan: 'https://base.easscan.org',
  },
  optimism: {
    chain: optimism,
    eas: '0x4200000000000000000000000000000000000021',
    registry: '0x4200000000000000000000000000000000000020',
    easscan: 'https://optimism.easscan.org',
  },
  mainnet: {
    chain: mainnet,
    eas: '0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587',
    registry: '0xA7b39296258348C78294F95B872b282326A97BDF',
    easscan: 'https://easscan.org',
  },
  arbitrum: {
    chain: arbitrum,
    eas: '0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458',
    registry: '0xA310da9c5B885E7fb3fbA9D66E9Ba6Df512b78eB',
    easscan: 'https://arbitrum.easscan.org',
  },
  sepolia: {
    chain: sepolia,
    eas: '0xC2679fBD37d54388Ce493F1DB75320D236e1815e',
    registry: '0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0',
    easscan: 'https://sepolia.easscan.org',
  },
}

export const EAS_CHAIN_NAMES = Object.keys(CHAINS)

export function chainInfo(cfg: RecommendationsConfig): EasChain {
  const c = CHAINS[cfg.chain ?? 'base']
  if (!c) throw new Error(`unsupported recommendations.chain: ${cfg.chain}`)
  return c
}

// The shared recommendation schema (see README): revocable, no resolver.
export const RECOMMENDATION_SCHEMA = 'string relationship,string recommendation'

// Schema UIDs are deterministic: keccak256(schema ‖ resolver ‖ revocable),
// per SchemaRegistry._getUID — so the UID is known before registering.
export function computeSchemaUid(schema: string, resolver: Address = zeroAddress, revocable = true): Hex {
  return keccak256(encodePacked(['string', 'address', 'bool'], [schema, resolver, revocable]))
}

// Registered = the chain's easscan indexer knows the UID.
export async function isSchemaRegistered(chainName: string, uid: Hex): Promise<boolean> {
  const { easscan } = chainInfo({ chain: chainName, schemaUid: uid })
  const res = await fetch(`${easscan}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query Schema($where: SchemaWhereUniqueInput!) { schema(where: $where) { id } }`,
      variables: { where: { id: uid } },
    }),
  })
  if (!res.ok) throw new Error(`easscan responded ${res.status}`)
  const json = (await res.json()) as { data?: { schema?: { id: string } | null } }
  return !!json.data?.schema?.id
}

const REGISTRY_ABI = [
  {
    name: 'register',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'schema', type: 'string' },
      { name: 'resolver', type: 'address' },
      { name: 'revocable', type: 'bool' },
    ],
    outputs: [{ type: 'bytes32' }],
  },
] as const

export async function registerRecommendationSchema(chainName: string): Promise<Hex> {
  const { chain, registry } = chainInfo({ chain: chainName, schemaUid: '' })
  const { wallet, account } = await connectedWalletClient(chain)
  return wallet.writeContract({
    account,
    address: registry,
    abi: REGISTRY_ABI,
    functionName: 'register',
    args: [RECOMMENDATION_SCHEMA, zeroAddress, true],
  })
}

const MAX_RECOMMENDATIONS = 50

interface AttestationRow {
  id: string
  attester: Address
  timeCreated: number
  decodedDataJson: string
}

function decodeRow(row: AttestationRow): Omit<Recommendation, 'isPublic' | 'attesterName'> | null {
  try {
    const fields = JSON.parse(row.decodedDataJson) as { name: string; value: { value: unknown } }[]
    const get = (name: string) => {
      const v = fields.find(f => f.name === name)?.value.value
      return typeof v === 'string' ? v.trim() : ''
    }
    const recommendation = get('recommendation')
    if (!recommendation) return null
    return {
      uid: row.id,
      attester: row.attester,
      time: Number(row.timeCreated),
      relationship: get('relationship'),
      recommendation,
    }
  } catch {
    return null
  }
}

// EFP (https://efp.app) gate: a recommendation is public once the receiver
// follows the attester — following is the web3-native "accept". Uses the
// list-scoped buttonStateBatch endpoint (the one EFP's own follow button
// uses) because it reflects new follows immediately, unlike the users/*
// followerState endpoint which lags behind the indexer. Two requests total:
// the receiver's primary list id, then one batch for every attester. Errors
// and accounts without an EFP list count as not-followed (hidden), the safe
// default.
const EFP_API = 'https://api.ethfollow.xyz/api/v1'

export async function efpFollowStates(receiver: Address, addresses: Address[]): Promise<boolean[]> {
  if (addresses.length === 0) return []
  try {
    const details = (await (await fetch(`${EFP_API}/users/${receiver}/details`)).json()) as {
      primary_list?: string | null
    }
    const list = details.primary_list
    if (!list) return addresses.map(() => false)

    const res = await fetch(`${EFP_API}/lists/${list}/buttonStateBatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addresses),
    })
    if (!res.ok) throw new Error(`efp responded ${res.status}`)
    const rows = (await res.json()) as {
      address: string
      state?: { follow?: boolean; block?: boolean; mute?: boolean }
    }[]
    const byAddress = new Map(
      rows.map(r => [r.address.toLowerCase(), !!r.state?.follow && !r.state.block && !r.state.mute])
    )
    return addresses.map(a => byAddress.get(a.toLowerCase()) ?? false)
  } catch {
    return addresses.map(() => false)
  }
}

export async function fetchRecommendations(cfg: RecommendationsConfig, recipient: Address): Promise<Recommendation[]> {
  const { easscan } = chainInfo(cfg)
  const res = await fetch(`${easscan}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query Recommendations($where: AttestationWhereInput!, $take: Int!) {
        attestations(where: $where, orderBy: { timeCreated: desc }, take: $take) {
          id attester timeCreated decodedDataJson
        }
      }`,
      variables: {
        take: MAX_RECOMMENDATIONS,
        where: {
          schemaId: { equals: cfg.schemaUid },
          recipient: { equals: recipient },
          revoked: { equals: false },
        },
      },
    }),
  })
  if (!res.ok) throw new Error(`easscan responded ${res.status}`)
  const json = (await res.json()) as { data?: { attestations?: AttestationRow[] }; errors?: unknown }
  if (!json.data?.attestations) throw new Error('easscan returned unexpected shape')

  const decoded = json.data.attestations.map(decodeRow).filter(r => r !== null)
  const followed = await efpFollowStates(
    recipient,
    decoded.map(r => r.attester)
  )
  return decoded.map((r, i) => ({ ...r, attesterName: null, isPublic: followed[i] }))
}

// Wallet plumbing (EIP-6963 discovery, connect, auto-reconnect) lives in
// ./wallets; this module only signs EAS transactions with the active wallet.
async function connectedWalletClient(chain: Chain) {
  const account = await connectWallet()
  const provider = activeProvider()
  if (!provider) throw new Error('No wallet detected.')
  const wallet = createWalletClient({ chain, transport: custom(provider) })
  try {
    await wallet.switchChain({ id: chain.id })
  } catch {
    // Wallet doesn't know the chain yet (EIP-3085), or refused: add + retry.
    await wallet.addChain({ chain })
    await wallet.switchChain({ id: chain.id })
  }
  return { wallet, account }
}

const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as const

const EAS_ATTEST_ABI = [
  {
    name: 'attest',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'request',
        type: 'tuple',
        components: [
          { name: 'schema', type: 'bytes32' },
          {
            name: 'data',
            type: 'tuple',
            components: [
              { name: 'recipient', type: 'address' },
              { name: 'expirationTime', type: 'uint64' },
              { name: 'revocable', type: 'bool' },
              { name: 'refUID', type: 'bytes32' },
              { name: 'data', type: 'bytes' },
              { name: 'value', type: 'uint256' },
            ],
          },
        ],
      },
    ],
    outputs: [{ type: 'bytes32' }],
  },
] as const

export async function submitRecommendation(
  cfg: RecommendationsConfig,
  params: { recipient: Address; relationship: string; recommendation: string }
): Promise<Hex> {
  const { chain, eas } = chainInfo(cfg)
  const { wallet, account } = await connectedWalletClient(chain)
  const data = encodeAbiParameters(
    [
      { name: 'relationship', type: 'string' },
      { name: 'recommendation', type: 'string' },
    ],
    [params.relationship.trim(), params.recommendation.trim()]
  )
  return wallet.writeContract({
    account,
    address: eas,
    abi: EAS_ATTEST_ABI,
    functionName: 'attest',
    args: [
      {
        schema: cfg.schemaUid as Hex,
        data: {
          recipient: params.recipient,
          expirationTime: 0n,
          revocable: true,
          refUID: ZERO_BYTES32,
          data,
          value: 0n,
        },
      },
    ],
  })
}
