// The canonical Ethereum blockies identicon (github.com/ethereum/blockies),
// emitted as an SVG data URI instead of a canvas so it can be an <img> src
// with zero dependencies. Deterministic per address and identical to the
// blockies wallets/explorers render.
const randseed = new Array<number>(4)

function seedrand(seed: string): void {
  randseed.fill(0)
  for (let i = 0; i < seed.length; i++) {
    randseed[i % 4] = (randseed[i % 4] << 5) - randseed[i % 4] + seed.charCodeAt(i)
  }
}

function rand(): number {
  const t = randseed[0] ^ (randseed[0] << 11)
  randseed[0] = randseed[1]
  randseed[1] = randseed[2]
  randseed[2] = randseed[3]
  randseed[3] = randseed[3] ^ (randseed[3] >> 19) ^ t ^ (t >> 8)
  return (randseed[3] >>> 0) / ((1 << 31) >>> 0)
}

function createColor(): string {
  const h = Math.floor(rand() * 360)
  const s = `${rand() * 60 + 40}%`
  const l = `${(rand() + rand() + rand() + rand()) * 25}%`
  return `hsl(${h},${s},${l})`
}

function createImageData(size: number): number[] {
  const dataWidth = Math.ceil(size / 2)
  const mirrorWidth = size - dataWidth
  const data: number[] = []
  for (let y = 0; y < size; y++) {
    let row: number[] = []
    for (let x = 0; x < dataWidth; x++) row[x] = Math.floor(rand() * 2.3)
    row = row.concat(row.slice(0, mirrorWidth).reverse())
    data.push(...row)
  }
  return data
}

export function blockieDataUri(address: string): string {
  seedrand(address.toLowerCase())
  const color = createColor()
  const bgcolor = createColor()
  const spotcolor = createColor()
  const size = 8
  const data = createImageData(size)
  let rects = ''
  for (let i = 0; i < data.length; i++) {
    if (data[i] === 0) continue
    const x = i % size
    const y = Math.floor(i / size)
    rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${data[i] === 1 ? color : spotcolor}"/>`
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="${bgcolor}"/>${rects}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
