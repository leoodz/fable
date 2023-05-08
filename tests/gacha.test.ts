// deno-lint-ignore-file no-explicit-any

import {
  assertEquals,
  assertObjectMatch,
  assertRejects,
} from 'https://deno.land/std@0.186.0/testing/asserts.ts';

import { FakeTime } from 'https://deno.land/std@0.186.0/testing/time.ts';

import {
  assertSpyCalls,
  returnsNext,
  Stub,
  stub,
} from 'https://deno.land/std@0.186.0/testing/mock.ts';

import Rating from '../src/rating.ts';

import gacha, { Pull } from '../src/gacha.ts';

import utils from '../src/utils.ts';
import packs from '../src/packs.ts';
import config from '../src/config.ts';

import {
  Character,
  CharacterRole,
  DisaggregatedCharacter,
  Manifest,
  Media,
  MediaFormat,
  MediaType,
  PackType,
} from '../src/types.ts';

import { AniListCharacter } from '../packs/anilist/types.ts';

import { NoPullsError, PoolError } from '../src/errors.ts';

function fakePool(
  { fill, variables, length = 1, rating }: {
    fill:
      | (AniListCharacter | DisaggregatedCharacter)
      | (AniListCharacter | DisaggregatedCharacter)[];
    variables: { range: number[]; role?: CharacterRole };
    length?: number;
    rating?: number;
  },
): {
  readJsonStub: Stub;
  fetchStub: Stub;
} {
  let nodes: (AniListCharacter | DisaggregatedCharacter)[];

  if (Array.isArray(fill)) {
    nodes = fill;
  } else {
    nodes = [];

    for (let index = 0; index < length; index++) {
      nodes.push(
        Object.assign(
          {},
          (fill.id = `${index + 1}`, fill),
        ),
      );
    }
  }

  const readJsonStub = stub(utils, 'readJson', () => {
    return Promise.resolve({
      [JSON.stringify(variables.range)]: {
        [variables.role || 'ALL']: nodes.map((node) => ({
          rating: rating ?? Rating.fromCharacter(node).stars,
          id: `${node.packId}:${node.id}`,
        })),
      },
    });
  });

  const fetchStub = stub(
    globalThis,
    'fetch',
    () => ({
      ok: true,
      text: (() =>
        Promise.resolve(JSON.stringify({
          data: {
            Page: {
              characters: nodes,
            },
          },
        }))),
    } as any),
  );

  return { readJsonStub, fetchStub };
}

Deno.test('filter invalid pools', async (test) => {
  await test.step('no media', async () => {
    const variables = {
      range: [2000, 3000],
      role: CharacterRole.Main,
    };

    const { readJsonStub, fetchStub } = fakePool(
      {
        fill: {
          id: '',
          packId: 'anilist',
          name: {
            full: 'name',
          },
          popularity: 2500,
          media: {
            edges: [],
          },
        },
        variables,
        length: 25,
      },
    );

    const rngStub = stub(
      utils,
      'rng',
      returnsNext([
        { value: variables.range, chance: NaN },
        { value: variables.role, chance: NaN },
      ]),
    );

    const randomStub = stub(Math, 'random', () => 0);

    const listStub = stub(packs, 'all', () => Promise.resolve([]));

    try {
      await assertRejects(
        async () =>
          await gacha.rngPull({
            userId: 'user_id',
            guildId: 'guild_id',
          }),
        PoolError,
        'failed to pull a character due to the pool not containing any characters that match the randomly chosen variables',
      );

      assertSpyCalls(fetchStub, 25);
      assertSpyCalls(rngStub, 2);
    } finally {
      rngStub.restore();
      randomStub.restore();
      readJsonStub.restore();
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('filter higher popularity media', async () => {
    const variables = {
      range: [1000, 2000],
    };

    const { readJsonStub, fetchStub } = fakePool(
      {
        fill: {
          id: '',
          packId: 'anilist',
          name: {
            full: 'name',
          },
          media: {
            edges: [{
              characterRole: CharacterRole.Main,
              node: {
                id: 'anime',
                type: MediaType.Anime,
                format: MediaFormat.TV,
                popularity: 2001,
                title: {
                  english: 'title',
                },
              },
            }],
          },
        },
        variables,
        length: 25,
      },
    );

    const rngStub = stub(
      utils,
      'rng',
      returnsNext([
        { value: variables.range, chance: NaN },
      ]),
    );

    const randomStub = stub(Math, 'random', () => 0);

    const listStub = stub(packs, 'all', () => Promise.resolve([]));

    try {
      await assertRejects(
        async () =>
          await gacha.rngPull({
            userId: 'user_id',
            guildId: 'guild_id',
          }),
        PoolError,
        'failed to pull a character due to the pool not containing any characters that match the randomly chosen variables',
      );

      assertSpyCalls(fetchStub, 25);
      assertSpyCalls(rngStub, 1);
    } finally {
      rngStub.restore();
      randomStub.restore();
      readJsonStub.restore();
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('filter higher popularity character', async () => {
    const variables = {
      range: [1000, 2000],
    };

    const { readJsonStub, fetchStub } = fakePool(
      {
        fill: {
          id: '',
          packId: 'anilist',
          name: {
            full: 'name',
          },
          popularity: 2001,
          media: {
            edges: [{
              characterRole: CharacterRole.Main,
              node: {
                id: 'anime',
                popularity: 1000,
                type: MediaType.Anime,
                format: MediaFormat.TV,
                title: {
                  english: 'title',
                },
              },
            }],
          },
        },
        variables,
        length: 25,
      },
    );

    const rngStub = stub(
      utils,
      'rng',
      returnsNext([
        { value: variables.range, chance: NaN },
      ]),
    );

    const randomStub = stub(Math, 'random', () => 0);

    const listStub = stub(packs, 'all', () => Promise.resolve([]));

    try {
      await assertRejects(
        async () =>
          await gacha.rngPull({
            userId: 'user_id',
            guildId: 'guild_id',
          }),
        PoolError,
        'failed to pull a character due to the pool not containing any characters that match the randomly chosen variables',
      );

      assertSpyCalls(fetchStub, 25);
      assertSpyCalls(rngStub, 1);
    } finally {
      rngStub.restore();
      randomStub.restore();
      readJsonStub.restore();
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('filter lesser popularity media', async () => {
    const variables = {
      range: [2000, 3000],
      role: CharacterRole.Main,
    };

    const { readJsonStub, fetchStub } = fakePool(
      {
        fill: {
          id: '',
          packId: 'anilist',
          name: {
            full: 'name',
          },
          media: {
            edges: [{
              characterRole: CharacterRole.Main,
              node: {
                id: 'anime',
                type: MediaType.Anime,
                format: MediaFormat.TV,
                popularity: 1999,
                title: {
                  english: 'title',
                },
              },
            }],
          },
        },
        variables,
        length: 25,
      },
    );

    const rngStub = stub(
      utils,
      'rng',
      returnsNext([
        { value: variables.range, chance: NaN },
        { value: variables.role, chance: NaN },
      ]),
    );

    const randomStub = stub(Math, 'random', () => 0);

    const listStub = stub(packs, 'all', () => Promise.resolve([]));

    try {
      await assertRejects(
        async () =>
          await gacha.rngPull({
            userId: 'user_id',
            guildId: 'guild_id',
          }),
        PoolError,
        'failed to pull a character due to the pool not containing any characters that match the randomly chosen variables',
      );

      assertSpyCalls(fetchStub, 25);
      assertSpyCalls(rngStub, 2);
    } finally {
      rngStub.restore();
      randomStub.restore();
      readJsonStub.restore();
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('filter lesser popularity character', async () => {
    const variables = {
      range: [2000, 3000],
      role: CharacterRole.Main,
    };

    const { readJsonStub, fetchStub } = fakePool(
      {
        fill: {
          id: '',
          packId: 'anilist',
          name: {
            full: 'name',
          },
          popularity: 1999,
          media: {
            edges: [{
              characterRole: CharacterRole.Main,
              node: {
                id: 'anime',
                popularity: 2500,
                type: MediaType.Anime,
                format: MediaFormat.TV,
                title: {
                  english: 'title',
                },
              },
            }],
          },
        },
        variables,
        length: 25,
      },
    );

    const rngStub = stub(
      utils,
      'rng',
      returnsNext([
        { value: variables.range, chance: NaN },
        { value: variables.role, chance: NaN },
      ]),
    );

    const randomStub = stub(Math, 'random', () => 0);

    const listStub = stub(packs, 'all', () => Promise.resolve([]));

    try {
      await assertRejects(
        async () =>
          await gacha.rngPull({
            userId: 'user_id',
            guildId: 'guild_id',
          }),
        PoolError,
        'failed to pull a character due to the pool not containing any characters that match the randomly chosen variables',
      );

      assertSpyCalls(fetchStub, 25);
      assertSpyCalls(rngStub, 2);
    } finally {
      rngStub.restore();
      randomStub.restore();
      readJsonStub.restore();
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('filter roles anilist', async () => {
    const variables = {
      range: [2000, 3000],
      role: CharacterRole.Main,
    };

    const { readJsonStub, fetchStub } = fakePool(
      {
        fill: {
          id: '',
          packId: 'anilist',
          name: {
            full: 'name',
          },
          media: {
            edges: [{
              characterRole: CharacterRole.Supporting,
              node: {
                id: 'anime',
                popularity: 2500,
                type: MediaType.Anime,
                format: MediaFormat.TV,
                title: {
                  english: 'title',
                },
              },
            }],
          },
        },
        variables,
        length: 25,
      },
    );

    const rngStub = stub(
      utils,
      'rng',
      returnsNext([
        { value: variables.range, chance: NaN },
        { value: variables.role, chance: NaN },
      ]),
    );

    const randomStub = stub(Math, 'random', () => 0);

    const listStub = stub(packs, 'all', () => Promise.resolve([]));

    try {
      await assertRejects(
        async () =>
          await gacha.rngPull({
            userId: 'user_id',
            guildId: 'guild_id',
          }),
        PoolError,
        'failed to pull a character due to the pool not containing any characters that match the randomly chosen variables',
      );

      assertSpyCalls(fetchStub, 25);
      assertSpyCalls(rngStub, 2);
    } finally {
      rngStub.restore();
      randomStub.restore();
      readJsonStub.restore();
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('filter roles packs', async () => {
    const variables = {
      range: [2000, 3000],
      role: CharacterRole.Main,
    };

    const { fetchStub, readJsonStub } = fakePool({
      fill: {} as any,
      variables,
      length: 0,
    });

    const manifest: Manifest = {
      id: 'pack-id',
      characters: {
        new: [{
          id: '1',
          name: {
            english: 'name',
          },
          media: [{
            role: CharacterRole.Supporting,
            mediaId: '2',
          }],
        }],
      },
      media: {
        new: [{
          id: '2',
          popularity: 2500,
          type: MediaType.Anime,
          format: MediaFormat.TV,
          title: {
            english: 'title',
          },
        }],
      },
    };

    const rngStub = stub(
      utils,
      'rng',
      returnsNext([
        { value: variables.range, chance: NaN },
        { value: variables.role, chance: NaN },
      ]),
    );

    const randomStub = stub(Math, 'random', () => 0);

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([{ manifest, type: PackType.Community }]),
    );

    packs.cachedGuilds = {
      'guild_id': [{ manifest, type: PackType.Community }],
    };

    try {
      await assertRejects(
        async () =>
          await gacha.rngPull({
            userId: 'user_id',
            guildId: 'guild_id',
          }),
        PoolError,
        'failed to pull a character due to the pool not containing any characters that match the randomly chosen variables',
      );

      assertSpyCalls(fetchStub, 0);
      assertSpyCalls(rngStub, 2);
    } finally {
      packs.cachedGuilds = {};

      rngStub.restore();
      randomStub.restore();
      readJsonStub.restore();
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('filter not equal stars', async () => {
    const variables = {
      range: [1000, 1_000_000],
    };

    const { readJsonStub, fetchStub } = fakePool(
      {
        fill: [
          {
            id: '1',
            packId: 'anilist',
            name: {
              full: 'name 1',
            },
            media: {
              edges: [{
                characterRole: CharacterRole.Main,
                node: {
                  id: '2',
                  popularity: 200_000,
                  type: MediaType.Anime,
                  format: MediaFormat.TV,
                  title: {
                    english: 'title 1',
                  },
                },
              }],
            },
          },
          {
            id: '3',
            packId: 'anilist',
            name: {
              full: 'name 2',
            },
            popularity: 1_000_000,
            media: {
              edges: [{
                characterRole: CharacterRole.Main,
                node: {
                  id: '4',
                  popularity: 1000,
                  type: MediaType.Anime,
                  format: MediaFormat.TV,
                  title: {
                    english: 'title 2',
                  },
                },
              }],
            },
          },
        ],
        variables,
        rating: 1,
      },
    );

    const rngStub = stub(utils, 'rng', () => undefined as any);

    const randomStub = stub(Math, 'random', () => 0);

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    try {
      await assertRejects(
        async () =>
          await gacha.rngPull({
            userId: 'user_id',
            guildId: 'guild_id',
            guarantee: 1,
          }),
        PoolError,
        'failed to pull a character due to the pool not containing any characters that match the randomly chosen variables',
      );

      assertSpyCalls(fetchStub, 2);
      assertSpyCalls(rngStub, 0);
    } finally {
      rngStub.restore();
      randomStub.restore();
      readJsonStub.restore();
      fetchStub.restore();
      listStub.restore();
    }
  });
});

Deno.test('disabled', async (test) => {
  await test.step('media', async () => {
    const variables = {
      range: [2000, 3000],
      role: CharacterRole.Main,
    };

    const manifest: Manifest = {
      id: 'pack-id',
      media: {
        conflicts: ['anilist:anime'],
      },
    };

    const { readJsonStub, fetchStub } = fakePool(
      {
        fill: {
          id: '',
          packId: 'anilist',
          name: {
            full: 'name',
          },
          media: {
            edges: [{
              characterRole: CharacterRole.Main,
              node: {
                id: 'anime',
                packId: 'anilist',
                popularity: 2500,
                type: MediaType.Anime,
                format: MediaFormat.TV,
                title: {
                  english: 'title',
                },
              },
            }],
          },
        },
        variables,
        length: 25,
      },
    );

    const rngStub = stub(
      utils,
      'rng',
      returnsNext([
        { value: variables.range, chance: NaN },
        { value: variables.role, chance: NaN },
      ]),
    );

    const randomStub = stub(Math, 'random', () => 0);

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([{ manifest, type: PackType.Community }]),
    );

    packs.cachedGuilds = {
      'guild_id': [{ manifest, type: PackType.Community }],
    };

    try {
      await assertRejects(
        async () =>
          await gacha.rngPull({
            userId: 'user_id',
            guildId: 'guild_id',
          }),
        PoolError,
        'failed to pull a character due to the pool not containing any characters that match the randomly chosen variables',
      );

      assertSpyCalls(fetchStub, 25);
      assertSpyCalls(rngStub, 2);
    } finally {
      packs.cachedGuilds = {};

      rngStub.restore();
      randomStub.restore();
      readJsonStub.restore();
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('character', async () => {
    const variables = {
      range: [2000, 3000],
      role: CharacterRole.Main,
    };

    const manifest: Manifest = {
      id: 'pack-id',
      media: {
        conflicts: ['anilist:1'],
      },
    };

    const { readJsonStub, fetchStub } = fakePool(
      {
        fill: {
          id: '',
          packId: 'anilist',
          name: {
            full: 'name',
          },
          media: {
            edges: [{
              characterRole: CharacterRole.Main,
              node: {
                id: 'anime',
                popularity: 75,
                type: MediaType.Anime,
                format: MediaFormat.TV,
                title: {
                  english: 'title',
                },
              },
            }],
          },
        },
        variables,
        length: 1,
      },
    );

    const rngStub = stub(
      utils,
      'rng',
      returnsNext([
        { value: variables.range, chance: NaN },
        { value: variables.role, chance: NaN },
      ]),
    );

    const randomStub = stub(Math, 'random', () => 0);

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([{ manifest, type: PackType.Community }]),
    );

    packs.cachedGuilds = {
      'guild_id': [{ manifest, type: PackType.Community }],
    };

    try {
      await assertRejects(
        async () =>
          await gacha.rngPull({
            userId: 'user_id',
            guildId: 'guild_id',
          }),
        PoolError,
        'failed to pull a character due to the pool not containing any characters that match the randomly chosen variables',
      );

      assertSpyCalls(fetchStub, 0);
      assertSpyCalls(rngStub, 2);
    } finally {
      packs.cachedGuilds = {};

      rngStub.restore();
      randomStub.restore();
      readJsonStub.restore();
      fetchStub.restore();
      listStub.restore();
    }
  });
});

Deno.test('valid pool', async (test) => {
  await test.step('normal', async () => {
    const variables = {
      range: [2000, 3000],
      role: CharacterRole.Main,
    };

    const { readJsonStub, fetchStub } = fakePool(
      {
        fill: {
          id: '',
          packId: 'anilist',
          name: {
            full: 'name',
          },
          media: {
            edges: [{
              characterRole: CharacterRole.Main,
              node: {
                id: 'anime',
                popularity: 2500,
                type: MediaType.Anime,
                format: MediaFormat.TV,
                title: {
                  english: 'title',
                },
              },
            }],
          },
        },
        variables,
        length: 25,
      },
    );

    const rngStub = stub(
      utils,
      'rng',
      returnsNext([
        { value: variables.range, chance: 0 },
        { value: variables.role, chance: 0 },
      ]),
    );

    const randomStub = stub(Math, 'random', () => 0);

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    try {
      assertEquals(
        await gacha.rngPull({
          guildId: 'guild_id',
        }),
        {
          character: {
            id: '1',
            packId: 'anilist',
            name: {
              english: 'name',
            },
            media: {
              edges: [
                {
                  node: {
                    format: MediaFormat.TV,
                    id: 'anime',
                    packId: 'anilist',
                    popularity: 2500,
                    title: {
                      english: 'title',
                    },
                    type: MediaType.Anime,
                  },
                  role: CharacterRole.Main,
                },
              ],
            },
          },
          media: {
            format: MediaFormat.TV,
            id: 'anime',
            packId: 'anilist',
            popularity: 2500,
            title: {
              english: 'title',
            },
            type: MediaType.Anime,
          },
          pool: 25,
          popularityChance: 0,
          popularityGreater: 2000,
          popularityLesser: 3000,
          remaining: undefined,
          guarantees: undefined,
          likes: undefined,
          rating: new Rating({ role: CharacterRole.Main, popularity: 75 }),
          roleChance: 0,
          role: CharacterRole.Main,
        },
      );

      assertSpyCalls(fetchStub, 1);
      assertSpyCalls(rngStub, 2);
    } finally {
      rngStub.restore();
      randomStub.restore();
      readJsonStub.restore();
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('exact popularity', async () => {
    const variables = {
      range: [2000, 3000],
      role: CharacterRole.Main,
    };

    const { readJsonStub, fetchStub } = fakePool(
      {
        fill: {
          id: '',
          packId: 'anilist',
          name: {
            full: 'name',
          },
          media: {
            edges: [{
              characterRole: CharacterRole.Main,
              node: {
                id: 'anime',
                popularity: 2000,
                type: MediaType.Anime,
                format: MediaFormat.TV,
                title: {
                  english: 'title',
                },
              },
            }],
          },
        },
        variables,
        length: 25,
      },
    );

    const rngStub = stub(
      utils,
      'rng',
      returnsNext([
        { value: variables.range, chance: 0 },
        { value: variables.role, chance: 0 },
      ]),
    );

    const randomStub = stub(Math, 'random', () => 0);

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    try {
      assertEquals(
        await gacha.rngPull({
          guildId: 'guild_id',
        }),
        {
          character: {
            id: '1',
            packId: 'anilist',
            name: {
              english: 'name',
            },
            media: {
              edges: [
                {
                  node: {
                    format: MediaFormat.TV,
                    id: 'anime',
                    packId: 'anilist',
                    popularity: 2000,
                    title: {
                      english: 'title',
                    },
                    type: MediaType.Anime,
                  },
                  role: CharacterRole.Main,
                },
              ],
            },
          },
          media: {
            format: MediaFormat.TV,
            id: 'anime',
            packId: 'anilist',
            popularity: 2000,
            title: {
              english: 'title',
            },
            type: MediaType.Anime,
          },
          pool: 25,
          popularityChance: 0,
          popularityGreater: 2000,
          popularityLesser: 3000,
          remaining: undefined,
          guarantees: undefined,
          likes: undefined,
          rating: new Rating({ role: CharacterRole.Main, popularity: 100 }),
          roleChance: 0,
          role: CharacterRole.Main,
        },
      );

      assertSpyCalls(fetchStub, 1);
      assertSpyCalls(rngStub, 2);
    } finally {
      rngStub.restore();
      randomStub.restore();
      readJsonStub.restore();
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('character popularity first', async () => {
    const variables = {
      range: [100_000, 500_000],
      role: CharacterRole.Main,
    };

    const { readJsonStub, fetchStub } = fakePool(
      {
        fill: {
          id: '',
          packId: 'anilist',
          name: {
            full: 'name',
          },
          popularity: 500000,
          media: {
            edges: [{
              characterRole: CharacterRole.Main,
              node: {
                id: 'anime',
                popularity: 100,
                type: MediaType.Anime,
                format: MediaFormat.TV,
                title: {
                  english: 'title',
                },
              },
            }],
          },
        },
        variables,
        length: 25,
      },
    );

    const rngStub = stub(
      utils,
      'rng',
      returnsNext([
        { value: variables.range, chance: 0 },
        { value: variables.role, chance: 0 },
      ]),
    );

    const randomStub = stub(Math, 'random', () => 0);

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    try {
      assertEquals(
        await gacha.rngPull({
          guildId: 'guild_id',
        }),
        {
          character: {
            id: '1',
            packId: 'anilist',
            name: {
              english: 'name',
            },
            popularity: 500_000,
            media: {
              edges: [
                {
                  node: {
                    format: MediaFormat.TV,
                    id: 'anime',
                    packId: 'anilist',
                    popularity: 100,
                    title: {
                      english: 'title',
                    },
                    type: MediaType.Anime,
                  },
                  role: CharacterRole.Main,
                },
              ],
            },
          },
          media: {
            format: MediaFormat.TV,
            id: 'anime',
            packId: 'anilist',
            popularity: 100,
            title: {
              english: 'title',
            },
            type: MediaType.Anime,
          },
          pool: 25,
          popularityChance: 0,
          popularityGreater: 100_000,
          popularityLesser: 500_000,
          remaining: undefined,
          guarantees: undefined,
          likes: undefined,
          rating: new Rating({ role: CharacterRole.Main, popularity: 500_000 }),
          roleChance: 0,
          role: CharacterRole.Main,
        },
      );

      assertSpyCalls(fetchStub, 1);
      assertSpyCalls(rngStub, 2);
    } finally {
      rngStub.restore();
      randomStub.restore();
      readJsonStub.restore();
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('from pack', async () => {
    const variables = {
      range: [2000, 3000],
      role: CharacterRole.Main,
    };

    const { fetchStub, readJsonStub } = fakePool({
      fill: {} as any,
      variables,
      length: 0,
    });

    const manifest: Manifest = {
      id: 'pack-id',
      characters: {
        new: [{
          id: '1',
          name: {
            english: 'name',
          },
          media: [{
            role: CharacterRole.Main,
            mediaId: '2',
          }],
        }],
      },
      media: {
        new: [{
          id: '2',
          popularity: 2500,
          type: MediaType.Anime,
          format: MediaFormat.TV,
          title: {
            english: 'title',
          },
        }],
      },
    };

    const rngStub = stub(
      utils,
      'rng',
      returnsNext([
        { value: variables.range, chance: 0 },
        { value: variables.role, chance: 0 },
      ]),
    );

    const randomStub = stub(Math, 'random', () => 0);

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([{ manifest, type: PackType.Community }]),
    );

    packs.cachedGuilds = {
      'guild_id': [{ manifest, type: PackType.Community }],
    };

    try {
      assertEquals(
        await gacha.rngPull({
          guildId: 'guild_id',
        }),
        {
          character: {
            id: '1',
            media: {
              edges: [
                {
                  node: {
                    format: MediaFormat.TV,
                    id: '2',
                    packId: 'pack-id',
                    popularity: 2500,
                    title: {
                      english: 'title',
                    },
                    type: MediaType.Anime,
                  },
                  role: CharacterRole.Main,
                },
              ],
            },
            name: {
              english: 'name',
            },
            packId: 'pack-id',
          },
          media: {
            format: MediaFormat.TV,
            id: '2',
            packId: 'pack-id',
            popularity: 2500,
            title: {
              english: 'title',
            },
            type: MediaType.Anime,
          },
          pool: 1,
          popularityChance: 0,
          popularityGreater: 2000,
          popularityLesser: 3000,
          remaining: undefined,
          guarantees: undefined,
          likes: undefined,
          rating: new Rating({ role: CharacterRole.Main, popularity: 2500 }),
          roleChance: 0,
          role: CharacterRole.Main,
        },
      );

      assertSpyCalls(fetchStub, 0);
      assertSpyCalls(rngStub, 2);
    } finally {
      packs.cachedGuilds = {};

      rngStub.restore();
      randomStub.restore();
      readJsonStub.restore();
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('guaranteed 1-star', async () => {
    const variables = {
      range: [1000, 50_000],
    };

    const { readJsonStub, fetchStub } = fakePool(
      {
        fill: [
          {
            id: '1',
            packId: 'anilist',
            name: {
              full: 'name 1',
            },
            media: {
              edges: [{
                characterRole: CharacterRole.Main,
                node: {
                  id: '2',
                  popularity: 1000,
                  type: MediaType.Anime,
                  format: MediaFormat.TV,
                  title: {
                    english: 'title 1',
                  },
                },
              }],
            },
          },
          {
            id: '1',
            packId: 'anilist',
            name: {
              full: 'name 1',
            },
            media: {
              edges: [{
                characterRole: CharacterRole.Main,
                node: {
                  id: '2',
                  popularity: 1000,
                  type: MediaType.Anime,
                  format: MediaFormat.TV,
                  title: {
                    english: 'title 1',
                  },
                },
              }],
            },
          },
        ],
        variables,
      },
    );

    const rngStub = stub(utils, 'rng', () => undefined as any);

    const randomStub = stub(Math, 'random', () => 0);

    const listStub = stub(packs, 'all', () => Promise.resolve([]));

    try {
      assertEquals(
        await gacha.rngPull({
          guildId: 'guild_id',
          guarantee: 1,
        }),
        {
          character: {
            id: '1',
            packId: 'anilist',
            name: {
              english: 'name 1',
            },
            media: {
              edges: [
                {
                  node: {
                    format: MediaFormat.TV,
                    id: '2',
                    packId: 'anilist',
                    popularity: 1000,
                    title: {
                      english: 'title 1',
                    },
                    type: MediaType.Anime,
                  },
                  role: CharacterRole.Main,
                },
              ],
            },
          },
          media: {
            format: MediaFormat.TV,
            id: '2',
            packId: 'anilist',
            popularity: 1000,
            title: {
              english: 'title 1',
            },
            type: MediaType.Anime,
          },
          pool: 2,
          remaining: undefined,
          guarantees: undefined,
          likes: undefined,
          rating: new Rating({ role: CharacterRole.Main, popularity: 1000 }),
        },
      );

      assertSpyCalls(fetchStub, 1);
      assertSpyCalls(rngStub, 0);
    } finally {
      rngStub.restore();
      randomStub.restore();
      readJsonStub.restore();
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('guaranteed 5-star', async () => {
    const variables = {
      range: [400_000, NaN],
    };

    const { readJsonStub, fetchStub } = fakePool(
      {
        fill: [
          {
            id: '1',
            packId: 'anilist',
            name: {
              full: 'name 1',
            },
            media: {
              edges: [{
                characterRole: CharacterRole.Main,
                node: {
                  id: '2',
                  popularity: 1000,
                  type: MediaType.Anime,
                  format: MediaFormat.TV,
                  title: {
                    english: 'title 1',
                  },
                },
              }],
            },
          },
          {
            id: '3',
            packId: 'anilist',
            name: {
              full: 'name 2',
            },
            media: {
              edges: [{
                characterRole: CharacterRole.Main,
                node: {
                  id: '4',
                  popularity: 400000,
                  type: MediaType.Anime,
                  format: MediaFormat.TV,
                  title: {
                    english: 'title 2',
                  },
                },
              }],
            },
          },
        ],
        variables,
      },
    );

    const rngStub = stub(
      utils,
      'rng',
      returnsNext([
        { value: CharacterRole.Main, chance: 100 },
      ]),
    );

    const randomStub = stub(Math, 'random', () => 0);

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    try {
      assertEquals(
        await gacha.rngPull({
          guildId: 'guild_id',
          guarantee: 5,
        }),
        {
          character: {
            id: '3',
            packId: 'anilist',
            name: {
              english: 'name 2',
            },
            media: {
              edges: [
                {
                  node: {
                    format: MediaFormat.TV,
                    id: '4',
                    packId: 'anilist',
                    popularity: 400_000,
                    title: {
                      english: 'title 2',
                    },
                    type: MediaType.Anime,
                  },
                  role: CharacterRole.Main,
                },
              ],
            },
          },
          media: {
            format: MediaFormat.TV,
            id: '4',
            packId: 'anilist',
            popularity: 400_000,
            title: {
              english: 'title 2',
            },
            type: MediaType.Anime,
          },
          pool: 1,
          remaining: undefined,
          guarantees: undefined,
          likes: undefined,
          rating: new Rating({ role: CharacterRole.Main, popularity: 400_000 }),
        },
      );

      assertSpyCalls(fetchStub, 1);
      assertSpyCalls(rngStub, 0);
    } finally {
      rngStub.restore();
      randomStub.restore();
      readJsonStub.restore();
      fetchStub.restore();
      listStub.restore();
    }
  });
});

Deno.test('adding character to inventory', async (test) => {
  await test.step('normal', async () => {
    const variables = {
      range: [2000, 3000],
      role: CharacterRole.Main,
    };

    const poolStub = stub(packs, 'pool', () =>
      Promise.resolve([
        {
          rating: 1,
          id: 'anilist:1',
        },
      ]));

    const rngStub = stub(
      utils,
      'rng',
      returnsNext([
        { value: variables.range, chance: NaN },
        { value: variables.role, chance: NaN },
      ]),
    );

    const fetchStub = stub(
      globalThis,
      'fetch',
      returnsNext([{
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                characters: [{
                  id: '1',
                  packId: 'anilist',
                  name: {
                    full: 'name',
                  },
                  media: {
                    edges: [{
                      characterRole: CharacterRole.Main,
                      node: {
                        id: 'anime',
                        popularity: 2500,
                        type: MediaType.Anime,
                        format: MediaFormat.TV,
                        title: {
                          english: 'title',
                        },
                      },
                    }],
                  },
                }],
              },
            },
          }))),
      } as any, {
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              addCharacterToInventory: {
                ok: true,
                likes: ['user_id', 'another_user_id'],
                character: {
                  _id: 'anchor',
                },
                inventory: {
                  availablePulls: 2,
                  user: {
                    guaranteed: [5, 4, 4, 3],
                  },
                },
              },
            },
          }))),
      }]),
    );

    const listStub = stub(packs, 'all', () => Promise.resolve([]));

    try {
      assertObjectMatch(
        await gacha.rngPull({
          userId: 'user_id',
          guildId: 'guild_id',
        }),
        {
          remaining: 2,
          likes: ['another_user_id'],
          character: {
            id: '1',
            packId: 'anilist',
            media: {
              edges: [
                {
                  node: {
                    format: MediaFormat.TV,
                    id: 'anime',
                    packId: 'anilist',
                    popularity: 2500,
                    title: {
                      english: 'title',
                    },
                    type: MediaType.Anime,
                  },
                  role: CharacterRole.Main,
                },
              ],
            },
            name: {
              english: 'name',
            },
          },
        },
      );

      assertSpyCalls(poolStub, 1);
      assertSpyCalls(fetchStub, 2);
    } finally {
      poolStub.restore();
      rngStub.restore();
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('character exists', async () => {
    const variables = {
      range: [2000, 3000],
      role: CharacterRole.Main,
    };

    const poolStub = stub(packs, 'pool', () =>
      Promise.resolve([
        {
          rating: 1,
          id: 'anilist:1',
        },
      ]));

    const rngStub = stub(
      utils,
      'rng',
      returnsNext([
        { value: variables.range, chance: NaN },
        { value: variables.role, chance: NaN },
      ]),
    );

    const fetchStub = stub(
      globalThis,
      'fetch',
      returnsNext([{
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                characters: [{
                  id: '1',
                  packId: 'anilist',
                  name: {
                    full: 'name',
                  },
                  media: {
                    edges: [{
                      characterRole: CharacterRole.Main,
                      node: {
                        id: 'anime',
                        popularity: 2500,
                        type: MediaType.Anime,
                        format: MediaFormat.TV,
                        title: {
                          english: 'title',
                        },
                      },
                    }],
                  },
                }],
              },
            },
          }))),
      } as any, {
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              addCharacterToInventory: {
                ok: false,
                error: 'CHARACTER_EXISTS',
              },
            },
          }))),
      }]),
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    try {
      await assertRejects(
        async () =>
          await gacha.rngPull({
            userId: 'user_id',
            guildId: 'guild_id',
          }),
        PoolError,
        'failed to pull a character due to the pool not containing any characters that match the randomly chosen variables',
      );

      assertSpyCalls(poolStub, 1);
      assertSpyCalls(fetchStub, 2);
    } finally {
      poolStub.restore();
      rngStub.restore();
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('no pulls available', async () => {
    const variables = {
      range: [2000, 3000],
      role: CharacterRole.Main,
    };

    const poolStub = stub(packs, 'pool', () =>
      Promise.resolve([
        {
          rating: 1,
          id: 'anilist:1',
        },
      ]));

    const rngStub = stub(
      utils,
      'rng',
      returnsNext([
        { value: variables.range, chance: NaN },
        { value: variables.role, chance: NaN },
      ]),
    );

    const fetchStub = stub(
      globalThis,
      'fetch',
      returnsNext([{
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                characters: [{
                  id: '1',
                  packId: 'anilist',
                  name: {
                    full: 'name',
                  },
                  media: {
                    edges: [{
                      characterRole: CharacterRole.Main,
                      node: {
                        id: 'anime',
                        popularity: 2500,
                        type: MediaType.Anime,
                        format: MediaFormat.TV,
                        title: {
                          english: 'title',
                        },
                      },
                    }],
                  },
                }],
              },
            },
          }))),
      } as any, {
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              addCharacterToInventory: {
                ok: false,
                error: 'NO_PULLS_AVAILABLE',
                inventory: {
                  rechargeTimestamp: '2023-02-07T01:00:55.222Z',
                },
              },
            },
          }))),
      }]),
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    try {
      await assertRejects(
        async () =>
          await gacha.rngPull({
            userId: 'user_id',
            guildId: 'guild_id',
          }),
        NoPullsError,
        'NO_PULLS_AVAILABLE',
      );

      assertSpyCalls(poolStub, 1);
      assertSpyCalls(fetchStub, 2);
    } finally {
      poolStub.restore();
      rngStub.restore();
      fetchStub.restore();
      listStub.restore();
    }
  });

  await test.step('no guarantees', async () => {
    const variables = {
      range: [2000, 3000],
      role: CharacterRole.Main,
    };

    const poolStub = stub(packs, 'pool', () =>
      Promise.resolve([
        {
          rating: 1,
          id: 'anilist:1',
        },
      ]));

    const rngStub = stub(
      utils,
      'rng',
      returnsNext([
        { value: variables.range, chance: NaN },
        { value: variables.role, chance: NaN },
      ]),
    );

    const fetchStub = stub(
      globalThis,
      'fetch',
      returnsNext([{
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              Page: {
                characters: [{
                  id: '1',
                  packId: 'anilist',
                  name: {
                    full: 'name',
                  },
                  media: {
                    edges: [{
                      characterRole: CharacterRole.Main,
                      node: {
                        id: 'anime',
                        popularity: 2500,
                        type: MediaType.Anime,
                        format: MediaFormat.TV,
                        title: {
                          english: 'title',
                        },
                      },
                    }],
                  },
                }],
              },
            },
          }))),
      } as any, {
        ok: true,
        text: (() =>
          Promise.resolve(JSON.stringify({
            data: {
              addCharacterToInventory: {
                ok: false,
                error: 'NO_GUARANTEES',
              },
            },
          }))),
      }]),
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    try {
      await assertRejects(
        async () =>
          await gacha.rngPull({
            userId: 'user_id',
            guildId: 'guild_id',
            guarantee: 1,
          }),
        Error,
        '403',
      );

      assertSpyCalls(poolStub, 1);
      assertSpyCalls(fetchStub, 2);
    } finally {
      poolStub.restore();
      rngStub.restore();
      fetchStub.restore();
      listStub.restore();
    }
  });
});

Deno.test('variables', () => {
  assertEquals(gacha.lowest, 1000);

  assertEquals(gacha.variables.roles, {
    10: CharacterRole.Main,
    70: CharacterRole.Supporting,
    20: CharacterRole.Background,
  });

  assertEquals(gacha.variables.ranges, {
    65: [1000, 50_000],
    22: [50_000, 100_000],
    9: [100_000, 200_000],
    3: [200_000, 400_000],
    1: [400_000, NaN],
  });
});

Deno.test('rating', async (test) => {
  await test.step('1 star', () => {
    let rating = new Rating({
      role: CharacterRole.Background,
      popularity: 1000000,
    });

    assertEquals(rating.stars, 1);
    assertEquals(
      rating.emotes,
      '<:star:1061016362832642098><:no_star:1061016360190222466><:no_star:1061016360190222466><:no_star:1061016360190222466><:no_star:1061016360190222466>',
    );

    rating = new Rating({ role: CharacterRole.Main, popularity: 0 });

    assertEquals(rating.stars, 1);
    assertEquals(
      rating.emotes,
      '<:star:1061016362832642098><:no_star:1061016360190222466><:no_star:1061016360190222466><:no_star:1061016360190222466><:no_star:1061016360190222466>',
    );

    rating = new Rating({ popularity: 0 });

    assertEquals(rating.stars, 1);
    assertEquals(
      rating.emotes,
      '<:star:1061016362832642098><:no_star:1061016360190222466><:no_star:1061016360190222466><:no_star:1061016360190222466><:no_star:1061016360190222466>',
    );
  });

  await test.step('2 stars', () => {
    let rating = new Rating({
      role: CharacterRole.Supporting,
      popularity: 199999,
    });

    assertEquals(rating.stars, 2);
    assertEquals(
      rating.emotes,
      '<:star:1061016362832642098><:star:1061016362832642098><:no_star:1061016360190222466><:no_star:1061016360190222466><:no_star:1061016360190222466>',
    );

    rating = new Rating({
      popularity: 199999,
    });

    assertEquals(rating.stars, 2);
    assertEquals(
      rating.emotes,
      '<:star:1061016362832642098><:star:1061016362832642098><:no_star:1061016360190222466><:no_star:1061016360190222466><:no_star:1061016360190222466>',
    );
  });

  await test.step('3 stars', () => {
    let rating = new Rating({ role: CharacterRole.Main, popularity: 199999 });

    assertEquals(rating.stars, 3);
    assertEquals(
      rating.emotes,
      '<:star:1061016362832642098><:star:1061016362832642098><:star:1061016362832642098><:no_star:1061016360190222466><:no_star:1061016360190222466>',
    );

    rating = new Rating({ role: CharacterRole.Supporting, popularity: 250000 });

    assertEquals(rating.stars, 3);
    assertEquals(
      rating.emotes,
      '<:star:1061016362832642098><:star:1061016362832642098><:star:1061016362832642098><:no_star:1061016360190222466><:no_star:1061016360190222466>',
    );

    rating = new Rating({ popularity: 250000 });

    assertEquals(rating.stars, 3);
    assertEquals(
      rating.emotes,
      '<:star:1061016362832642098><:star:1061016362832642098><:star:1061016362832642098><:no_star:1061016360190222466><:no_star:1061016360190222466>',
    );
  });

  await test.step('4 stars', () => {
    let rating = new Rating({ role: CharacterRole.Main, popularity: 250000 });

    assertEquals(rating.stars, 4);
    assertEquals(
      rating.emotes,
      '<:star:1061016362832642098><:star:1061016362832642098><:star:1061016362832642098><:star:1061016362832642098><:no_star:1061016360190222466>',
    );

    rating = new Rating({ role: CharacterRole.Supporting, popularity: 500000 });

    assertEquals(rating.stars, 4);
    assertEquals(
      rating.emotes,
      '<:star:1061016362832642098><:star:1061016362832642098><:star:1061016362832642098><:star:1061016362832642098><:no_star:1061016360190222466>',
    );

    rating = new Rating({ popularity: 500000 });

    assertEquals(rating.stars, 4);
    assertEquals(
      rating.emotes,
      '<:star:1061016362832642098><:star:1061016362832642098><:star:1061016362832642098><:star:1061016362832642098><:no_star:1061016360190222466>',
    );
  });

  await test.step('5 stars', () => {
    let rating = new Rating({ role: CharacterRole.Main, popularity: 400000 });

    assertEquals(rating.stars, 5);
    assertEquals(
      rating.emotes,
      '<:star:1061016362832642098><:star:1061016362832642098><:star:1061016362832642098><:star:1061016362832642098><:star:1061016362832642098>',
    );

    rating = new Rating({ popularity: 1000000 });

    assertEquals(rating.stars, 5);
    assertEquals(
      rating.emotes,
      '<:star:1061016362832642098><:star:1061016362832642098><:star:1061016362832642098><:star:1061016362832642098><:star:1061016362832642098>',
    );
  });

  await test.step('fixed rating', () => {
    const rating = new Rating({
      stars: 1,
    });

    assertEquals(rating.stars, 1);
    assertEquals(
      rating.emotes,
      '<:star:1061016362832642098><:no_star:1061016360190222466><:no_star:1061016360190222466><:no_star:1061016360190222466><:no_star:1061016360190222466>',
    );
  });

  await test.step('defaults', async (test) => {
    await test.step('undefined popularity with role', () => {
      const rating = new Rating({
        role: CharacterRole.Main,

        popularity: undefined as any,
      });

      assertEquals(rating.stars, 1);
    });

    await test.step('undefined popularity', () => {
      const rating = new Rating({
        popularity: undefined as any,
      });

      assertEquals(rating.stars, 1);
    });
  });
});

Deno.test('/gacha', async (test) => {
  await test.step('normal', async () => {
    const media: Media = {
      id: '1',
      packId: 'pack-id',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      popularity: 100,
      title: {
        english: 'title',
      },
      images: [{
        url: 'media_image_url',
      }],
    };

    const character: Character = {
      id: '2',
      packId: 'pack-id-2',
      name: {
        english: 'name',
      },
      images: [{
        url: 'character_image_url',
      }],
      media: {
        edges: [{
          role: CharacterRole.Main,
          node: media,
        }],
      },
    };

    const pull: Pull = {
      media,
      character,
      popularityChance: 0,
      popularityGreater: 0,
      popularityLesser: 100,
      rating: new Rating({ popularity: 100 }),
      remaining: 0,
      pool: 1,
    };

    const timeStub = new FakeTime();

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => undefined as any,
    );

    const pullStub = stub(
      gacha,
      'rngPull',
      returnsNext([Promise.resolve(pull)]),
    );

    config.gacha = true;
    config.appId = 'app_id';
    config.origin = 'http://localhost:8000';

    try {
      const message = gacha.start({
        userId: 'user_id',
        guildId: 'guild_id',
        channelId: 'channel_id',
        token: 'test_token',
      });

      assertEquals(message.json(), {
        type: 4,
        data: {
          attachments: [],
          components: [],
          embeds: [{
            type: 'rich',
            image: {
              url: 'http://localhost:8000/assets/spinner.gif',
            },
          }],
        },
      });

      await timeStub.runMicrotasks();

      assertSpyCalls(fetchStub, 1);

      assertEquals(
        fetchStub.calls[0].args[0],
        'https://discord.com/api/v10/webhooks/app_id/test_token/messages/@original',
      );

      assertEquals(fetchStub.calls[0].args[1]?.method, 'PATCH');

      assertEquals(
        JSON.parse(
          (fetchStub.calls[0].args[1]?.body as FormData)?.get(
            'payload_json',
          ) as any,
        ),
        {
          embeds: [{
            type: 'rich',
            title: 'title',
            image: {
              url: 'http://localhost:8000/external/media_image_url?size=medium',
            },
          }],
          components: [],
          attachments: [],
        },
      );

      await timeStub.nextAsync();

      assertSpyCalls(fetchStub, 2);

      assertEquals(
        fetchStub.calls[1].args[0],
        'https://discord.com/api/v10/webhooks/app_id/test_token/messages/@original',
      );

      assertEquals(fetchStub.calls[1].args[1]?.method, 'PATCH');

      assertEquals(
        JSON.parse(
          (fetchStub.calls[1].args[1]?.body as FormData)?.get(
            'payload_json',
          ) as any,
        ),
        {
          embeds: [{
            type: 'rich',
            image: {
              url: 'http://localhost:8000/assets/stars/1.gif',
            },
          }],
          components: [],
          attachments: [],
        },
      );

      await timeStub.nextAsync();

      assertSpyCalls(fetchStub, 3);

      assertEquals(
        fetchStub.calls[2].args[0],
        'https://discord.com/api/v10/webhooks/app_id/test_token/messages/@original',
      );

      assertEquals(fetchStub.calls[2].args[1]?.method, 'PATCH');

      assertEquals(
        JSON.parse(
          (fetchStub.calls[2].args[1]?.body as FormData)?.get(
            'payload_json',
          ) as any,
        ),
        {
          attachments: [],
          embeds: [{
            type: 'rich',
            description: new Rating({ popularity: 100 }).emotes,
            fields: [{
              name: 'title',
              value: '**name**',
            }],
            image: {
              url: 'http://localhost:8000/external/character_image_url',
            },
          }],
          components: [{
            type: 1,
            components: [
              {
                custom_id: 'gacha=user_id',
                label: '/gacha',
                disabled: true,
                style: 2,
                type: 2,
              },
              {
                custom_id: 'character=pack-id-2:2=1',
                label: '/character',
                style: 2,
                type: 2,
              },
              {
                custom_id: 'like=pack-id-2:2',
                label: '/like',
                style: 2,
                type: 2,
              },
            ],
          }],
        },
      );
    } finally {
      delete config.appId;
      delete config.origin;
      delete config.gacha;

      timeStub.restore();
      pullStub.restore();
      fetchStub.restore();
    }
  });

  await test.step('guarantees', async () => {
    const media: Media = {
      id: '1',
      packId: 'pack-id',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      popularity: 100,
      title: {
        english: 'title',
      },
      images: [{
        url: 'media_image_url',
      }],
    };

    const character: Character = {
      id: '2',
      packId: 'pack-id-2',
      name: {
        english: 'name',
      },
      images: [{
        url: 'character_image_url',
      }],
      media: {
        edges: [{
          role: CharacterRole.Main,
          node: media,
        }],
      },
    };

    const pull: Pull = {
      media,
      character,
      popularityChance: 0,
      popularityGreater: 0,
      popularityLesser: 100,
      guarantees: [3, 4, 3],
      rating: new Rating({ popularity: 100 }),
      remaining: 1,
      pool: 1,
    };

    const timeStub = new FakeTime();

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => undefined as any,
    );

    const pullStub = stub(
      gacha,
      'rngPull',
      returnsNext([Promise.resolve(pull)]),
    );

    config.gacha = true;
    config.appId = 'app_id';
    config.origin = 'http://localhost:8000';

    try {
      const message = gacha.start({
        userId: 'user_id',
        guildId: 'guild_id',
        channelId: 'channel_id',
        token: 'test_token',
        guarantee: 5,
      });

      assertEquals(message.json(), {
        type: 4,
        data: {
          attachments: [],
          components: [],
          embeds: [{
            type: 'rich',
            image: {
              url: 'http://localhost:8000/assets/spinner.gif',
            },
          }],
        },
      });

      await timeStub.runMicrotasks();

      assertSpyCalls(fetchStub, 1);

      assertEquals(
        fetchStub.calls[0].args[0],
        'https://discord.com/api/v10/webhooks/app_id/test_token/messages/@original',
      );

      assertEquals(fetchStub.calls[0].args[1]?.method, 'PATCH');

      assertEquals(
        JSON.parse(
          (fetchStub.calls[0].args[1]?.body as FormData)?.get(
            'payload_json',
          ) as any,
        ),
        {
          embeds: [{
            type: 'rich',
            title: 'title',
            image: {
              url: 'http://localhost:8000/external/media_image_url?size=medium',
            },
          }],
          components: [],
          attachments: [],
        },
      );

      await timeStub.nextAsync();

      assertSpyCalls(fetchStub, 2);

      assertEquals(
        fetchStub.calls[1].args[0],
        'https://discord.com/api/v10/webhooks/app_id/test_token/messages/@original',
      );

      assertEquals(fetchStub.calls[1].args[1]?.method, 'PATCH');

      assertEquals(
        JSON.parse(
          (fetchStub.calls[1].args[1]?.body as FormData)?.get(
            'payload_json',
          ) as any,
        ),
        {
          embeds: [{
            type: 'rich',
            image: {
              url: 'http://localhost:8000/assets/stars/1.gif',
            },
          }],
          components: [],
          attachments: [],
        },
      );

      await timeStub.nextAsync();

      assertSpyCalls(fetchStub, 3);

      assertEquals(
        fetchStub.calls[2].args[0],
        'https://discord.com/api/v10/webhooks/app_id/test_token/messages/@original',
      );

      assertEquals(fetchStub.calls[2].args[1]?.method, 'PATCH');

      assertEquals(
        JSON.parse(
          (fetchStub.calls[2].args[1]?.body as FormData)?.get(
            'payload_json',
          ) as any,
        ),
        {
          attachments: [],
          embeds: [{
            type: 'rich',
            description: new Rating({ popularity: 100 }).emotes,
            fields: [{
              name: 'title',
              value: '**name**',
            }],
            image: {
              url: 'http://localhost:8000/external/character_image_url',
            },
          }],
          components: [{
            type: 1,
            components: [
              {
                custom_id: 'pull=user_id=4',
                label: '/pull 4',
                style: 2,
                type: 2,
              },
              {
                custom_id: 'character=pack-id-2:2=1',
                label: '/character',
                style: 2,
                type: 2,
              },
              {
                custom_id: 'like=pack-id-2:2',
                label: '/like',
                style: 2,
                type: 2,
              },
            ],
          }],
        },
      );
    } finally {
      delete config.appId;
      delete config.origin;
      delete config.gacha;

      timeStub.restore();
      pullStub.restore();
      fetchStub.restore();
    }
  });

  await test.step('mention', async () => {
    const media: Media = {
      id: '1',
      packId: 'pack-id',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      popularity: 100,
      title: {
        english: 'title',
      },
      images: [{
        url: 'media_image_url',
      }],
    };

    const character: Character = {
      id: '2',
      packId: 'pack-id-2',
      name: {
        english: 'name',
      },
      images: [{
        url: 'character_image_url',
      }],
      media: {
        edges: [{
          role: CharacterRole.Main,
          node: media,
        }],
      },
    };

    const pull: Pull = {
      media,
      character,
      popularityChance: 0,
      popularityGreater: 0,
      popularityLesser: 100,
      rating: new Rating({ popularity: 100 }),
      remaining: 1,
      pool: 1,
    };

    const timeStub = new FakeTime();

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => undefined as any,
    );

    const pullStub = stub(
      gacha,
      'rngPull',
      returnsNext([Promise.resolve(pull)]),
    );

    config.gacha = true;
    config.appId = 'app_id';
    config.origin = 'http://localhost:8000';

    try {
      const message = gacha.start({
        mention: true,
        userId: 'user_id',
        guildId: 'guild_id',
        channelId: 'channel_id',
        token: 'test_token',
      });

      assertEquals(message.json(), {
        type: 4,
        data: {
          content: '<@user_id>',
          allowed_mentions: { parse: [] },
          attachments: [],
          components: [],
          embeds: [{
            type: 'rich',
            image: {
              url: 'http://localhost:8000/assets/spinner.gif',
            },
          }],
        },
      });

      await timeStub.runMicrotasks();

      assertSpyCalls(fetchStub, 1);

      assertEquals(
        fetchStub.calls[0].args[0],
        'https://discord.com/api/v10/webhooks/app_id/test_token/messages/@original',
      );

      assertEquals(fetchStub.calls[0].args[1]?.method, 'PATCH');

      assertEquals(
        JSON.parse(
          (fetchStub.calls[0].args[1]?.body as FormData)?.get(
            'payload_json',
          ) as any,
        ),
        {
          content: '<@user_id>',
          allowed_mentions: { parse: [] },
          components: [],
          attachments: [],
          embeds: [{
            type: 'rich',
            title: 'title',
            image: {
              url: 'http://localhost:8000/external/media_image_url?size=medium',
            },
          }],
        },
      );

      await timeStub.nextAsync();

      assertSpyCalls(fetchStub, 2);

      assertEquals(
        fetchStub.calls[1].args[0],
        'https://discord.com/api/v10/webhooks/app_id/test_token/messages/@original',
      );

      assertEquals(fetchStub.calls[1].args[1]?.method, 'PATCH');

      assertEquals(
        JSON.parse(
          (fetchStub.calls[1].args[1]?.body as FormData)?.get(
            'payload_json',
          ) as any,
        ),
        {
          content: '<@user_id>',
          allowed_mentions: { parse: [] },
          components: [],
          attachments: [],
          embeds: [{
            type: 'rich',
            image: {
              url: 'http://localhost:8000/assets/stars/1.gif',
            },
          }],
        },
      );

      await timeStub.nextAsync();

      assertSpyCalls(fetchStub, 3);

      assertEquals(
        fetchStub.calls[2].args[0],
        'https://discord.com/api/v10/webhooks/app_id/test_token/messages/@original',
      );

      assertEquals(fetchStub.calls[2].args[1]?.method, 'PATCH');

      assertEquals(
        JSON.parse(
          (fetchStub.calls[2].args[1]?.body as FormData)?.get(
            'payload_json',
          ) as any,
        ),
        {
          content: '<@user_id>',
          allowed_mentions: { parse: [] },
          attachments: [],
          embeds: [{
            type: 'rich',
            description: new Rating({ popularity: 100 }).emotes,
            fields: [{
              name: 'title',
              value: '**name**',
            }],
            image: {
              url: 'http://localhost:8000/external/character_image_url',
            },
          }],
          components: [{
            type: 1,
            components: [
              {
                custom_id: 'gacha=user_id',
                label: '/gacha',
                style: 2,
                type: 2,
              },
              {
                custom_id: 'character=pack-id-2:2=1',
                label: '/character',
                style: 2,
                type: 2,
              },
              {
                custom_id: 'like=pack-id-2:2',
                label: '/like',
                style: 2,
                type: 2,
              },
            ],
          }],
        },
      );
    } finally {
      delete config.appId;
      delete config.origin;
      delete config.gacha;

      timeStub.restore();
      pullStub.restore();
      fetchStub.restore();
    }
  });

  await test.step('quiet', async () => {
    const media: Media = {
      id: '1',
      packId: 'pack-id',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      popularity: 100,
      title: {
        english: 'title',
      },
      images: [{
        url: 'media_image_url',
      }],
    };

    const character: Character = {
      id: '2',
      packId: 'pack-id-2',
      name: {
        english: 'name',
      },
      images: [{
        url: 'character_image_url',
      }],
      media: {
        edges: [{
          role: CharacterRole.Main,
          node: media,
        }],
      },
    };

    const pull: Pull = {
      media,
      character,
      popularityChance: 0,
      popularityGreater: 0,
      popularityLesser: 100,
      rating: new Rating({ popularity: 100 }),
      remaining: 1,
      pool: 1,
    };

    const timeStub = new FakeTime();

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => undefined as any,
    );

    const pullStub = stub(
      gacha,
      'rngPull',
      returnsNext([Promise.resolve(pull)]),
    );

    config.gacha = true;
    config.appId = 'app_id';
    config.origin = 'http://localhost:8000';

    try {
      const message = gacha.start({
        token: 'test_token',
        userId: 'user_id',
        guildId: 'guild_id',
        channelId: 'channel_id',
        quiet: true,
      });

      assertEquals(message.json(), {
        type: 4,
        data: {
          attachments: [],
          components: [],
          embeds: [{
            type: 'rich',
            image: {
              url: 'http://localhost:8000/assets/spinner.gif',
            },
          }],
        },
      });

      await timeStub.runMicrotasks();

      assertSpyCalls(fetchStub, 1);

      assertEquals(
        fetchStub.calls[0].args[0],
        'https://discord.com/api/v10/webhooks/app_id/test_token/messages/@original',
      );

      assertEquals(fetchStub.calls[0].args[1]?.method, 'PATCH');

      assertEquals(
        JSON.parse(
          (fetchStub.calls[0].args[1]?.body as FormData)?.get(
            'payload_json',
          ) as any,
        ),
        {
          attachments: [],
          embeds: [{
            type: 'rich',
            description: new Rating({ popularity: 100 }).emotes,
            fields: [{
              name: 'title',
              value: '**name**',
            }],
            image: {
              url: 'http://localhost:8000/external/character_image_url',
            },
          }],
          components: [{
            type: 1,
            components: [
              {
                custom_id: 'q=user_id',
                label: '/q',
                style: 2,
                type: 2,
              },
              {
                custom_id: 'character=pack-id-2:2=1',
                label: '/character',
                style: 2,
                type: 2,
              },
              {
                custom_id: 'like=pack-id-2:2',
                label: '/like',
                style: 2,
                type: 2,
              },
            ],
          }],
        },
      );
    } finally {
      delete config.appId;
      delete config.origin;
      delete config.gacha;

      timeStub.restore();
      pullStub.restore();
      fetchStub.restore();
    }
  });

  await test.step('likes', async () => {
    const media: Media = {
      id: '1',
      packId: 'pack-id',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      popularity: 100,
      title: {
        english: 'title',
      },
      images: [{
        url: 'media_image_url',
      }],
    };

    const character: Character = {
      id: '2',
      packId: 'pack-id-2',
      name: {
        english: 'name',
      },
      images: [{
        url: 'character_image_url',
      }],
      media: {
        edges: [{
          role: CharacterRole.Main,
          node: media,
        }],
      },
    };

    const pull: Pull = {
      media,
      character,
      popularityChance: 0,
      popularityGreater: 0,
      popularityLesser: 100,
      likes: ['another_user_id'],
      rating: new Rating({ popularity: 100 }),
      remaining: 1,
      pool: 1,
    };

    const timeStub = new FakeTime();

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => undefined as any,
    );

    const pullStub = stub(
      gacha,
      'rngPull',
      returnsNext([Promise.resolve(pull)]),
    );

    config.gacha = true;
    config.appId = 'app_id';
    config.origin = 'http://localhost:8000';

    try {
      const message = gacha.start({
        userId: 'user_id',
        guildId: 'guild_id',
        channelId: 'channel_id',
        token: 'test_token',
      });

      assertEquals(message.json(), {
        type: 4,
        data: {
          attachments: [],
          components: [],
          embeds: [{
            type: 'rich',
            image: {
              url: 'http://localhost:8000/assets/spinner.gif',
            },
          }],
        },
      });

      await timeStub.runMicrotasks();

      assertSpyCalls(fetchStub, 1);

      assertEquals(
        fetchStub.calls[0].args[0],
        'https://discord.com/api/v10/webhooks/app_id/test_token/messages/@original',
      );

      assertEquals(fetchStub.calls[0].args[1]?.method, 'PATCH');

      assertEquals(
        JSON.parse(
          (fetchStub.calls[0].args[1]?.body as FormData)?.get(
            'payload_json',
          ) as any,
        ),
        {
          embeds: [{
            type: 'rich',
            title: 'title',
            image: {
              url: 'http://localhost:8000/external/media_image_url?size=medium',
            },
          }],
          components: [],
          attachments: [],
        },
      );

      await timeStub.nextAsync();

      assertSpyCalls(fetchStub, 2);

      assertEquals(
        fetchStub.calls[1].args[0],
        'https://discord.com/api/v10/webhooks/app_id/test_token/messages/@original',
      );

      assertEquals(fetchStub.calls[1].args[1]?.method, 'PATCH');

      assertEquals(
        JSON.parse(
          (fetchStub.calls[1].args[1]?.body as FormData)?.get(
            'payload_json',
          ) as any,
        ),
        {
          embeds: [{
            type: 'rich',
            image: {
              url: 'http://localhost:8000/assets/stars/1.gif',
            },
          }],
          components: [],
          attachments: [],
        },
      );

      await timeStub.nextAsync();

      assertSpyCalls(fetchStub, 3);

      assertEquals(
        fetchStub.calls[2].args[0],
        'https://discord.com/api/v10/webhooks/app_id/test_token/messages/@original',
      );

      assertEquals(fetchStub.calls[2].args[1]?.method, 'PATCH');

      assertEquals(
        JSON.parse(
          (fetchStub.calls[2].args[1]?.body as FormData)?.get(
            'payload_json',
          ) as any,
        ),
        {
          attachments: [],
          embeds: [{
            type: 'rich',
            description: new Rating({ popularity: 100 }).emotes,
            fields: [{
              name: 'title',
              value: '**name**',
            }],
            image: {
              url: 'http://localhost:8000/external/character_image_url',
            },
          }],
          components: [{
            type: 1,
            components: [
              {
                custom_id: 'gacha=user_id',
                label: '/gacha',
                style: 2,
                type: 2,
              },
              {
                custom_id: 'character=pack-id-2:2=1',
                label: '/character',
                style: 2,
                type: 2,
              },
              {
                custom_id: 'like=pack-id-2:2',
                label: '/like',
                style: 2,
                type: 2,
              },
            ],
          }],
        },
      );

      await timeStub.runMicrotasks();

      assertSpyCalls(fetchStub, 4);

      assertEquals(
        fetchStub.calls[3].args[0],
        'https://discord.com/api/v10/webhooks/app_id/test_token',
      );

      assertEquals(fetchStub.calls[3].args[1]?.method, 'POST');

      assertEquals(
        JSON.parse(
          (fetchStub.calls[3].args[1]?.body as FormData)?.get(
            'payload_json',
          ) as any,
        ),
        {
          embeds: [],
          components: [],
          attachments: [],
          content: '<@another_user_id>',
        },
      );
    } finally {
      delete config.appId;
      delete config.origin;
      delete config.gacha;

      timeStub.restore();
      pullStub.restore();
      fetchStub.restore();
    }
  });

  await test.step('nsfw', async () => {
    const media: Media = {
      id: '1',
      packId: 'pack-id',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      popularity: 100,
      title: {
        english: 'title',
      },
      images: [{
        nsfw: true,
        url: 'media_image_url',
      }],
    };

    const character: Character = {
      id: '2',
      packId: 'pack-id-2',
      name: {
        english: 'name',
      },
      images: [{
        nsfw: true,
        url: 'character_image_url',
      }],
      media: {
        edges: [{
          role: CharacterRole.Main,
          node: media,
        }],
      },
    };

    const pull: Pull = {
      media,
      character,
      popularityChance: 0,
      popularityGreater: 0,
      popularityLesser: 100,
      rating: new Rating({ popularity: 100 }),
      remaining: 1,
      pool: 1,
    };

    const timeStub = new FakeTime();

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => undefined as any,
    );

    const pullStub = stub(
      gacha,
      'rngPull',
      returnsNext([Promise.resolve(pull)]),
    );

    config.gacha = true;
    config.appId = 'app_id';
    config.origin = 'http://localhost:8000';

    try {
      const message = gacha.start({
        userId: 'user_id',
        guildId: 'guild_id',
        channelId: 'channel_id',
        token: 'test_token',
      });

      assertEquals(message.json(), {
        type: 4,
        data: {
          attachments: [],
          components: [],
          embeds: [{
            type: 'rich',
            image: {
              url: 'http://localhost:8000/assets/spinner.gif',
            },
          }],
        },
      });

      await timeStub.runMicrotasks();

      assertSpyCalls(fetchStub, 1);

      assertEquals(
        fetchStub.calls[0].args[0],
        'https://discord.com/api/v10/webhooks/app_id/test_token/messages/@original',
      );

      assertEquals(fetchStub.calls[0].args[1]?.method, 'PATCH');

      assertEquals(
        JSON.parse(
          (fetchStub.calls[0].args[1]?.body as FormData)?.get(
            'payload_json',
          ) as any,
        ),
        {
          embeds: [{
            type: 'rich',
            title: 'title',
            image: {
              url:
                'http://localhost:8000/external/media_image_url?size=medium&blur',
            },
          }],
          components: [],
          attachments: [],
        },
      );

      await timeStub.nextAsync();

      assertSpyCalls(fetchStub, 2);

      assertEquals(
        fetchStub.calls[1].args[0],
        'https://discord.com/api/v10/webhooks/app_id/test_token/messages/@original',
      );

      assertEquals(fetchStub.calls[1].args[1]?.method, 'PATCH');

      assertEquals(
        JSON.parse(
          (fetchStub.calls[1].args[1]?.body as FormData)?.get(
            'payload_json',
          ) as any,
        ),
        {
          embeds: [{
            type: 'rich',
            image: {
              url: 'http://localhost:8000/assets/stars/1.gif',
            },
          }],
          components: [],
          attachments: [],
        },
      );

      await timeStub.nextAsync();

      assertSpyCalls(fetchStub, 3);

      assertEquals(
        fetchStub.calls[2].args[0],
        'https://discord.com/api/v10/webhooks/app_id/test_token/messages/@original',
      );

      assertEquals(fetchStub.calls[2].args[1]?.method, 'PATCH');

      assertEquals(
        JSON.parse(
          (fetchStub.calls[2].args[1]?.body as FormData)?.get(
            'payload_json',
          ) as any,
        ),
        {
          attachments: [],
          embeds: [{
            type: 'rich',
            description: new Rating({ popularity: 100 }).emotes,
            fields: [{
              name: 'title',
              value: '**name**',
            }],
            image: {
              url: 'http://localhost:8000/external/character_image_url?blur',
            },
          }],
          components: [{
            type: 1,
            components: [
              {
                custom_id: 'gacha=user_id',
                label: '/gacha',
                style: 2,
                type: 2,
              },
              {
                custom_id: 'character=pack-id-2:2=1',
                label: '/character',
                style: 2,
                type: 2,
              },
              {
                custom_id: 'like=pack-id-2:2',
                label: '/like',
                style: 2,
                type: 2,
              },
            ],
          }],
        },
      );
    } finally {
      delete config.appId;
      delete config.origin;
      delete config.gacha;

      timeStub.restore();
      pullStub.restore();
      fetchStub.restore();
    }
  });

  await test.step('nsfw 2', async () => {
    const media: Media = {
      id: '1',
      packId: 'pack-id',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      popularity: 100,
      title: {
        english: 'title',
      },
      images: [{
        nsfw: true,
        url: 'media_image_url',
      }],
    };

    const character: Character = {
      id: '2',
      packId: 'pack-id-2',
      name: {
        english: 'name',
      },
      images: [{
        nsfw: true,
        url: 'character_image_url',
      }],
      media: {
        edges: [{
          role: CharacterRole.Main,
          node: media,
        }],
      },
    };

    const pull: Pull = {
      media,
      character,
      popularityChance: 0,
      popularityGreater: 0,
      popularityLesser: 100,
      rating: new Rating({ popularity: 100 }),
      remaining: 1,
      pool: 1,
    };

    const timeStub = new FakeTime();

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => undefined as any,
    );

    const pullStub = stub(
      gacha,
      'rngPull',
      returnsNext([Promise.resolve(pull)]),
    );

    config.gacha = true;
    config.appId = 'app_id';
    config.origin = 'http://localhost:8000';

    packs.cachedChannels['channel_id'] = {
      nsfw: true,
      name: 'channel',
      id: 'channel_id',
    };

    try {
      const message = gacha.start({
        userId: 'user_id',
        guildId: 'guild_id',
        channelId: 'channel_id',
        token: 'test_token',
      });

      assertEquals(message.json(), {
        type: 4,
        data: {
          attachments: [],
          components: [],
          embeds: [{
            type: 'rich',
            image: {
              url: 'http://localhost:8000/assets/spinner.gif',
            },
          }],
        },
      });

      await timeStub.runMicrotasks();

      assertSpyCalls(fetchStub, 1);

      assertEquals(
        fetchStub.calls[0].args[0],
        'https://discord.com/api/v10/webhooks/app_id/test_token/messages/@original',
      );

      assertEquals(fetchStub.calls[0].args[1]?.method, 'PATCH');

      assertEquals(
        JSON.parse(
          (fetchStub.calls[0].args[1]?.body as FormData)?.get(
            'payload_json',
          ) as any,
        ),
        {
          embeds: [{
            type: 'rich',
            title: 'title',
            image: {
              url: 'http://localhost:8000/external/media_image_url?size=medium',
            },
          }],
          components: [],
          attachments: [],
        },
      );

      await timeStub.nextAsync();

      assertSpyCalls(fetchStub, 2);

      assertEquals(
        fetchStub.calls[1].args[0],
        'https://discord.com/api/v10/webhooks/app_id/test_token/messages/@original',
      );

      assertEquals(fetchStub.calls[1].args[1]?.method, 'PATCH');

      assertEquals(
        JSON.parse(
          (fetchStub.calls[1].args[1]?.body as FormData)?.get(
            'payload_json',
          ) as any,
        ),
        {
          embeds: [{
            type: 'rich',
            image: {
              url: 'http://localhost:8000/assets/stars/1.gif',
            },
          }],
          components: [],
          attachments: [],
        },
      );

      await timeStub.nextAsync();

      assertSpyCalls(fetchStub, 3);

      assertEquals(
        fetchStub.calls[2].args[0],
        'https://discord.com/api/v10/webhooks/app_id/test_token/messages/@original',
      );

      assertEquals(fetchStub.calls[2].args[1]?.method, 'PATCH');

      assertEquals(
        JSON.parse(
          (fetchStub.calls[2].args[1]?.body as FormData)?.get(
            'payload_json',
          ) as any,
        ),
        {
          attachments: [],
          embeds: [{
            type: 'rich',
            description: new Rating({ popularity: 100 }).emotes,
            fields: [{
              name: 'title',
              value: '**name**',
            }],
            image: {
              url: 'http://localhost:8000/external/character_image_url',
            },
          }],
          components: [{
            type: 1,
            components: [
              {
                custom_id: 'gacha=user_id',
                label: '/gacha',
                style: 2,
                type: 2,
              },
              {
                custom_id: 'character=pack-id-2:2=1',
                label: '/character',
                style: 2,
                type: 2,
              },
              {
                custom_id: 'like=pack-id-2:2',
                label: '/like',
                style: 2,
                type: 2,
              },
            ],
          }],
        },
      );
    } finally {
      delete config.appId;
      delete config.origin;
      delete config.gacha;

      delete packs.cachedChannels['channel_id'];

      timeStub.restore();
      pullStub.restore();
      fetchStub.restore();
    }
  });

  await test.step('no pulls available', async () => {
    const timeStub = new FakeTime();

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => undefined as any,
    );

    const pullStub = stub(
      gacha,
      'rngPull',
      // deno-lint-ignore require-await
      async () => {
        throw new NoPullsError('2023-02-07T00:53:09.199Z');
      },
    );

    config.gacha = true;
    config.appId = 'app_id';
    config.origin = 'http://localhost:8000';

    try {
      const message = gacha.start({
        token: 'test_token',
        guildId: 'guild_id',
        channelId: 'channel_id',
      });

      assertEquals(message.json(), {
        type: 4,
        data: {
          attachments: [],
          components: [],
          embeds: [{
            type: 'rich',
            image: {
              url: 'http://localhost:8000/assets/spinner.gif',
            },
          }],
        },
      });

      await timeStub.runMicrotasks();

      assertEquals(
        fetchStub.calls[0].args[0],
        'https://discord.com/api/v10/webhooks/app_id/test_token/messages/@original',
      );

      assertEquals(fetchStub.calls[0].args[1]?.method, 'PATCH');

      assertEquals(
        JSON.parse(
          (fetchStub.calls[0].args[1]?.body as FormData)?.get(
            'payload_json',
          ) as any,
        ),
        {
          embeds: [
            {
              type: 'rich',
              description: 'You don\'t have any more pulls!',
            },
            { type: 'rich', description: '_+1 pull <t:1675732989:R>_' },
          ],
          components: [],
          attachments: [],
        },
      );
    } finally {
      delete config.appId;
      delete config.origin;
      delete config.gacha;

      timeStub.restore();
      pullStub.restore();
      fetchStub.restore();
    }
  });

  await test.step('no guaranteed', async () => {
    const timeStub = new FakeTime();

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => undefined as any,
    );

    const pullStub = stub(
      gacha,
      'rngPull',
      // deno-lint-ignore require-await
      async () => {
        throw new Error('403');
      },
    );

    config.gacha = true;
    config.appId = 'app_id';
    config.origin = 'http://localhost:8000';

    try {
      const message = gacha.start({
        token: 'test_token',
        userId: 'user_id',
        guildId: 'guild_id',
        channelId: 'channel_id',
        guarantee: 5,
      });

      assertEquals(message.json(), {
        type: 4,
        data: {
          attachments: [],
          components: [],
          embeds: [{
            type: 'rich',
            image: {
              url: 'http://localhost:8000/assets/spinner.gif',
            },
          }],
        },
      });

      await timeStub.runMicrotasks();

      assertEquals(
        fetchStub.calls[0].args[0],
        'https://discord.com/api/v10/webhooks/app_id/test_token/messages/@original',
      );

      assertEquals(fetchStub.calls[0].args[1]?.method, 'PATCH');

      assertEquals(
        JSON.parse(
          (fetchStub.calls[0].args[1]?.body as FormData)?.get(
            'payload_json',
          ) as any,
        ),
        {
          attachments: [],
          components: [{
            type: 1,
            components: [{
              custom_id: 'buy=bguaranteed=user_id=5',
              label: '/buy guaranteed 5',
              style: 2,
              type: 2,
            }],
          }],
          embeds: [
            {
              type: 'rich',
              description:
                'You don`t have any 5<:smol_star:1088427421096751224>pulls',
            },
          ],
        },
      );
    } finally {
      delete config.appId;
      delete config.origin;
      delete config.gacha;

      timeStub.restore();
      pullStub.restore();
      fetchStub.restore();
    }
  });

  await test.step('no more characters', async () => {
    const timeStub = new FakeTime();

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => undefined as any,
    );

    const pullStub = stub(
      gacha,
      'rngPull',
      // deno-lint-ignore require-await
      async () => {
        throw new PoolError({} as any);
      },
    );

    config.gacha = true;
    config.appId = 'app_id';
    config.origin = 'http://localhost:8000';

    try {
      const message = gacha.start({
        token: 'test_token',
        guildId: 'guild_id',
        channelId: 'channel_id',
      });

      assertEquals(message.json(), {
        type: 4,
        data: {
          attachments: [],
          components: [],
          embeds: [{
            type: 'rich',
            image: {
              url: 'http://localhost:8000/assets/spinner.gif',
            },
          }],
        },
      });

      await timeStub.runMicrotasks();

      assertEquals(
        fetchStub.calls[0].args[0],
        'https://discord.com/api/v10/webhooks/app_id/test_token/messages/@original',
      );

      assertEquals(fetchStub.calls[0].args[1]?.method, 'PATCH');

      assertEquals(
        JSON.parse(
          (fetchStub.calls[0].args[1]?.body as FormData)?.get(
            'payload_json',
          ) as any,
        ),
        {
          embeds: [
            {
              type: 'rich',
              description: 'There are no more characters left',
            },
          ],
          components: [],
          attachments: [],
        },
      );
    } finally {
      delete config.appId;
      delete config.origin;
      delete config.gacha;

      timeStub.restore();
      pullStub.restore();
      fetchStub.restore();
    }
  });

  await test.step('no more guaranteed characters', async () => {
    const timeStub = new FakeTime();

    const fetchStub = stub(
      globalThis,
      'fetch',
      () => undefined as any,
    );

    const pullStub = stub(
      gacha,
      'rngPull',
      // deno-lint-ignore require-await
      async () => {
        throw new PoolError({} as any);
      },
    );

    config.gacha = true;
    config.appId = 'app_id';
    config.origin = 'http://localhost:8000';

    try {
      const message = gacha.start({
        token: 'test_token',
        guildId: 'guild_id',
        channelId: 'channel_id',
        guarantee: 5,
      });

      assertEquals(message.json(), {
        type: 4,
        data: {
          attachments: [],
          components: [],
          embeds: [{
            type: 'rich',
            image: {
              url: 'http://localhost:8000/assets/spinner.gif',
            },
          }],
        },
      });

      await timeStub.runMicrotasks();

      assertEquals(
        fetchStub.calls[0].args[0],
        'https://discord.com/api/v10/webhooks/app_id/test_token/messages/@original',
      );

      assertEquals(fetchStub.calls[0].args[1]?.method, 'PATCH');

      assertEquals(
        JSON.parse(
          (fetchStub.calls[0].args[1]?.body as FormData)?.get(
            'payload_json',
          ) as any,
        ),
        {
          embeds: [
            {
              type: 'rich',
              description:
                'There are no more 5<:smol_star:1088427421096751224>characters left',
            },
          ],
          components: [],
          attachments: [],
        },
      );
    } finally {
      delete config.appId;
      delete config.origin;
      delete config.gacha;

      timeStub.restore();
      pullStub.restore();
      fetchStub.restore();
    }
  });
});
