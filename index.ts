import params from 'doc999tor-fast-geoip/build/params.js'

import { binarySearch, firstArrayItem, getNextIp, identity, ipStr2Num, type Format, type indexFile, type ipBlockRecord, type locationRecord } from './utils.ts'

const JSON = { with: { type: 'json' } }
const ipCache: Record<string, Format> = {}
const locationCache = import('doc999tor-fast-geoip/data/locations.json', JSON).then(m => m.default as locationRecord[])

async function readFile<T extends Format> (filename: string): Promise<T> {
  if (ipCache[filename] !== undefined) {
    return await Promise.resolve(ipCache[filename] as T)
  }
  const content = await import('doc999tor-fast-geoip/data/' + filename + '.json', JSON).then(m => m.default as T)
  ipCache[filename] = content
  return content
}

interface IpInfo {
  range: [number, number]
  country: string
  region: string
  eu: '0'|'1'
  timezone: string
  city: string
  ll: [number, number]
  metro: number
  area: number
}

export async function lookup (stringifiedIp: string): Promise<IpInfo> {
  const ip = ipStr2Num(stringifiedIp)
  let nextIp: number = ipStr2Num('255.255.255.255')
  const data = await readFile<indexFile>('index')
  // IP cannot be NaN
  if (Object.is(ip, NaN)) { throw new Error('IP cannot be NaN') }
  const rootIndex = binarySearch(data, ip, identity)
  if (rootIndex === -1) {
    // Ip is not in the database, return empty object
    throw new Error('IP not found in the database')
  }
  nextIp = getNextIp<number>(data, rootIndex, nextIp, identity)
  const data2 = await readFile<indexFile>('i' + rootIndex)
  const index = binarySearch(data2, ip, identity) + rootIndex * params.NUMBER_NODES_PER_MIDINDEX
  nextIp = getNextIp<number>(data2, index, nextIp, identity)
  const data3 = await readFile<ipBlockRecord[]>('' + index)
  const index1 = binarySearch(data3, ip, firstArrayItem)
  const ipData = data3[index1]!
  if (ipData[1] == null) {
    throw new Error("IP doesn't any region nor country associated")
  }
  nextIp = getNextIp<ipBlockRecord>(data3, index1, nextIp, firstArrayItem)
  const data4 = (await locationCache)[ipData[1]]!
  return {
    range: [ipData[0], nextIp] as [number, number],
    country: data4[0],
    region: data4[1],
    eu: data4[5],
    timezone: data4[4],
    city: data4[2],
    ll: [ipData[2], ipData[3]] as [number, number],
    metro: data4[3],
    area: ipData[4]
  }
}
