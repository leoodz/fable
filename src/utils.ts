import nacl from 'tweetnacl';

import { chunk } from '$std/collections/chunk.ts';

import {
  captureException as _captureException,
  init as initSentry,
} from 'sentry';

import { LRU } from 'lru';

import { json, serve, serveStatic, validateRequest } from 'sift';

import { distance as _distance } from 'levenshtein';

import { proxy } from '../images-proxy/mod.ts';

import { RECHARGE_MINS } from '../db/mod.ts';

const TEN_MIB = 1024 * 1024 * 10;

const lru = new LRU<{ body: ArrayBuffer; headers: Headers }>(20);

export enum ImageSize {
  Preview = 'preview',
  Thumbnail = 'thumbnail',
  Medium = 'medium',
  Large = 'large',
}

function getRandomFloat(): number {
  const randomInt = crypto.getRandomValues(new Uint32Array(1))[0];
  return randomInt / 2 ** 32;
}

// function randomPortions(
//   min: number,
//   max: number,
//   length: number,
//   sum: number,
// ): number[] {
//   return Array.from({ length }, (_, i) => {
//     const smin = (length - i - 1) * min;
//     const smax = (length - i - 1) * max;

//     const offset = Math.max(sum - smax, min);
//     const random = 1 + Math.min(sum - offset, max - offset, sum - smin - min);

//     const value = Math.floor(Math.random() * random + offset);

//     sum -= value;

//     return value;
//   });
// }

function hexToInt(hex?: string): number | undefined {
  if (!hex) {
    return;
  }

  const color = hex.substring(1);

  const R = color.substring(0, 2);
  const G = color.substring(2, 4);
  const B = color.substring(4, 6);

  return parseInt(`${R}${G}${B}`, 16);
}

function shuffle<T>(array: T[]): void {
  for (
    let i = 0, length = array.length, swap = 0, temp = null;
    i < length;
    i++
  ) {
    swap = Math.floor(Math.random() * (i + 1));
    temp = array[swap];
    array[swap] = array[i];
    array[i] = temp;
  }
}

function sleep(secs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, secs * 1000));
}

function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit,
  n = 0,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    fetch(input, init)
      .then((result) => resolve(result))
      .catch(async (err) => {
        if (n >= 2) {
          return reject(err);
        }

        await sleep(0.5);

        fetchWithRetry(input, init, n + 1)
          .then(resolve)
          .catch(reject);
      });
  });
}

function rng<T>(dict: { [chance: number]: T }): { value: T; chance: number } {
  const pool = Object.values(dict);

  const chances = Object.keys(dict).map((n) => parseInt(n));

  const sum = chances.reduce((a, b) => a + b);

  if (sum !== 100) {
    throw new Error(`Sum of ${chances} is ${sum} when it should be 100`);
  }

  const _ = [];

  for (let i = 0; i < chances.length; i++) {
    // if chance is 5 - add 5 items to the array
    // if chance is 90 - add 90 items to the array
    for (let y = 0; y < chances[i]; y++) {
      // push the index of the item not it's value
      _.push(i);
    }
  }

  // shuffle the generated chances array
  // which is the RNG part of this function
  shuffle(_);

  // use the first item from the shuffled array on the pool
  return {
    value: pool[_[0]],
    chance: chances[_[0]],
  };
}

function truncate(
  str: string | undefined,
  n: number,
): string | undefined {
  if (str && str.length > n) {
    const s = str.substring(0, n - 2);
    return s.slice(0, s.lastIndexOf(' ')) +
      '...';
  }

  return str;
}

function wrap(text: string, width = 32): string {
  return text.replace(
    new RegExp(`(?![^\\n]{1,${width}}$)([^\\n]{1,${width}})\\s`, 'g'),
    '$1\n',
  );
}

function capitalize(s: string | undefined): string | undefined {
  if (!s) {
    return;
  }

  if (s.length <= 3) {
    return s.toUpperCase();
  }

  return s
    .split(/_|\s/)
    .map((s) => s[0].toUpperCase() + s.slice(1).toLowerCase())
    .join(' ')
    .trim();
}

function compact(n: number): string {
  if (n <= 0) {
    return '0';
  }

  const units = ['', 'K', 'M', 'G', 'T', 'P', 'E'];
  const index = Math.floor(Math.log10(Math.abs(n)) / 3);
  const value = n / Math.pow(10, index * 3);

  const formattedValue = value.toFixed(1)
    .replace(/\.0+$/, '');

  return formattedValue + units[index];
}

function comma(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// function chunks<T>(a: Array<T>, size: number): T[][] {
//   return Array.from(
//     new Array(Math.ceil(a.length / size)),
//     (_, i) => a.slice(i * size, i * size + size),
//   );
// }

function distance(a: string, b: string): number {
  return 100 -
    100 * _distance(a.toLowerCase(), b.toLowerCase()) / (a.length + b.length);
}

function _parseInt(query?: string): number | undefined {
  if (query === undefined) {
    return;
  }

  const id = parseInt(query);

  if (!isNaN(id) && id.toString() === query) {
    return id;
  }
}

function decodeDescription(s?: string): string | undefined {
  if (!s) {
    return;
  }

  s = s.replaceAll('&lt;', '<');
  s = s.replaceAll('&gt;', '>');
  s = s.replaceAll('&#039;', '\'');
  s = s.replaceAll('&quot;', '"');
  s = s.replaceAll('&apos;', '\'');
  s = s.replaceAll('&rsquo;', '\'');
  s = s.replaceAll('&mdash;', '-');
  s = s.replaceAll('&amp;', '&');

  s = s.replace(/~![\S\s]+!~/gm, '');
  s = s.replace(/\|\|[\S\s]+\|\|/gm, '');

  s = s.replace(/<i.*?>([\S\s]*?)<\/?i>/g, (_, s) => `*${s.trim()}*`);
  s = s.replace(/<b.*?>([\S\s]*?)<\/?b>/g, (_, s) => `**${s.trim()}**`);
  s = s.replace(
    /<strike.*?>([\S\s]*)<\/?strike>/g,
    (_, s) => `~~${s.trim()}~~`,
  );

  s = s.replace(/<\/?br\/?>|<\/?hr\/?>/gm, '\n');

  s = s.replace(/<a.*?href=("|')(.*?)("|').*?>([\S\s]*?)<\/?a>/g, '[$4]($2)');

  return s;
}

function hexToUint8Array(hex: string): Uint8Array | undefined {
  const t = hex.match(/.{1,2}/g)?.map((val) => parseInt(val, 16));

  if (t?.length) {
    return new Uint8Array(t);
  }
}

function verifySignature(
  { publicKey, signature, timestamp, body }: {
    publicKey?: string;
    signature?: string | null;
    timestamp?: string | null;
    body: string;
  },
): { valid: boolean; body: string } {
  if (!signature || !timestamp || !publicKey) {
    return { valid: false, body };
  }

  const valid = nacl.sign.detached.verify(
    new TextEncoder().encode(timestamp + body),
    // deno-lint-ignore no-non-null-assertion
    hexToUint8Array(signature)!,
    // deno-lint-ignore no-non-null-assertion
    hexToUint8Array(publicKey)!,
  );

  return { valid, body };
}

async function readJson<T>(filePath: string): Promise<T> {
  try {
    const jsonString = await Deno.readTextFile(filePath);
    return JSON.parse(jsonString);
  } catch (err) {
    err.message = `${filePath}: ${err.message}`;
    throw err;
  }
}

function rechargeTimestamp(v?: string): string {
  const parsed = new Date(v ?? new Date());

  parsed.setMinutes(parsed.getMinutes() + RECHARGE_MINS);

  const ts = parsed.getTime();

  // discord uses seconds not milliseconds
  return Math.floor(ts / 1000).toString();
}

function votingTimestamp(v?: string): { canVote: boolean; timeLeft: string } {
  const parsed = new Date(v ?? new Date());

  parsed.setHours(parsed.getHours() + 12);

  const ts = parsed.getTime();

  return {
    canVote: Date.now() >= parsed.getTime(),
    // discord uses seconds not milliseconds
    timeLeft: Math.floor(ts / 1000).toString(),
  };
}

function stealTimestamp(v?: string): string {
  const parsed = new Date(v ?? new Date());

  const ts = parsed.getTime();

  // discord uses seconds not milliseconds
  return Math.floor(ts / 1000).toString();
}

function diffInDays(a: Date, b: Date): number {
  return Math.floor(Math.abs(a.getTime() - b.getTime()) / 3600000 / 24);
}

function diffInMinutes(a: Date, b: Date): number {
  return Math.floor(Math.abs(a.getTime() - b.getTime()) / 60000);
}

const base64Encode = (base64: string): string => {
  const ENC = {
    '+': '-',
    '/': '_',
  };

  return base64
    .replace(/[+/]/g, (m) => ENC[m as keyof typeof ENC]);
};

const base64Decode = (safe: string): string => {
  const DEC = {
    '-': '+',
    '_': '/',
    '.': '=',
  };

  return safe
    .replace(/[-_.]/g, (m) => DEC[m as keyof typeof DEC]);
};

function cipher(str: string, secret: number): string {
  let b = '';

  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);

    code = code + secret;

    b += String.fromCharCode(code);
  }

  return base64Encode(btoa(b));
}

function decipher(a: string, secret: number): string {
  let str = '';

  const b = atob(base64Decode(a));

  for (let i = 0; i < b.length; i++) {
    let code = b.charCodeAt(i);

    code = code - secret;

    str += String.fromCharCode(code);
  }

  return str;
}

function captureException(err: Error, opts?: {
  // deno-lint-ignore no-explicit-any
  extra?: any;
}): string {
  return _captureException(err, {
    extra: {
      ...err.cause ?? {},
      ...opts?.extra ?? {},
    },
  });
}

async function handleProxy(r: Request): Promise<Response> {
  const url = new URL(r.url);

  const key = (url.pathname + url.search)
    .substring(1);

  const hit = lru.get(key);

  if (hit) {
    console.log(`cache hit: ${key}`);

    return new Response(hit.body, { headers: hit.headers });
  }

  const imageUrl = decodeURIComponent(
    url.pathname
      .replace('/external/', ''),
  );

  const { format, image } = await proxy(
    imageUrl,
    // deno-lint-ignore no-explicit-any
    url.searchParams.get('size') as any,
  );

  const response = new Response(image.buffer, {
    headers: {
      'content-type': format,
      'content-length': `${image.byteLength}`,
      'cache-control': `max-age=${86400 * 12}`,
    },
  });

  if (image.byteLength <= TEN_MIB) {
    const v = {
      body: image.buffer,
      headers: response.headers,
    };

    lru.set(key, v);
  }

  return response;
}

function captureOutage(id: string): Promise<Response> {
  return fetch(
    `https://api.instatus.com/v3/integrations/webhook/${id}`,
    {
      method: 'POST',
      body: JSON.stringify({
        'trigger': 'down',
      }),
    },
  );
}

const utils = {
  capitalize,
  captureException,
  captureOutage,
  chunks: chunk,
  cipher,
  comma,
  compact,
  decipher,
  decodeDescription,
  diffInDays,
  diffInMinutes,
  distance,
  fetchWithRetry,
  getRandomFloat,
  handleProxy,
  hexToInt,
  initSentry,
  json,
  parseInt: _parseInt,
  // randomPortions,
  readJson,
  rechargeTimestamp,
  rng,
  serve,
  serveStatic,
  shuffle,
  sleep,
  stealTimestamp,
  truncate,
  validateRequest,
  verifySignature,
  votingTimestamp,
  wrap,
};

export default utils;
