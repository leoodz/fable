// deno-lint-ignore-file no-explicit-any

import { assertEquals, assertRejects } from '$std/assert/mod.ts';

import { assertSpyCalls, returnsNext, stub } from '$std/testing/mock.ts';

import { assertSnapshot } from '$std/testing/snapshot.ts';

import { FakeTime } from '$std/testing/time.ts';

import utils from '../src/utils.ts';

import packs from '../src/packs.ts';
import gacha from '../src/gacha.ts';

import config from '../src/config.ts';

import Rating from '../src/rating.ts';

import merge from '../src/merge.ts';

import db from '../db/mod.ts';

import { CharacterRole, MediaFormat, MediaType } from '../src/types.ts';

import { AniListCharacter, AniListMedia } from '../packs/anilist/types.ts';

import { NonFetalError, PoolError } from '../src/errors.ts';

Deno.test('auto merge', async (test) => {
  await test.step('5 ones', async (test) => {
    const characters = Array(25).fill({}).map((_, i) => ({
      value: {
        rating: 1,
        id: `id:${i}`,
      },
    }));

    const [sacrifices] = merge.getSacrifices(characters as any, 'target', 2);

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 1).length,
      5,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 2).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 3).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 4).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 5).length,
      0,
    );

    await assertSnapshot(test, sacrifices);
  });

  await test.step('25 ones', async (test) => {
    const characters = Array(25).fill({}).map((_, i) => ({
      value: {
        rating: 1,
        id: `id:${i}`,
      },
    }));

    const [sacrifices] = merge.getSacrifices(characters as any, 'target', 3);

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 1).length,
      25,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 2).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 3).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 4).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 5).length,
      0,
    );

    await assertSnapshot(test, sacrifices);
  });

  await test.step('5 twos', async (test) => {
    const characters = Array(25).fill({}).map((_, i) => ({
      value: {
        rating: 2,
        id: `id:${i}`,
        mediaId: 'media_id',
        user: { id: 'user_id' },
      },
    }));

    const [sacrifices] = merge.getSacrifices(characters as any, 'target', 3);

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 1).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 2).length,
      5,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 3).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 4).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 5).length,
      0,
    );

    await assertSnapshot(test, sacrifices);
  });

  await test.step('20 ones + 1 two', async (test) => {
    const characters = Array(20).fill({}).map((_, i) => ({
      value: {
        rating: 1,
        id: `id:${i}`,
        mediaId: 'media_id',
        user: { id: 'user_id' },
      },
    })).concat(
      [{
        value: {
          rating: 2,
          id: `id:20`,
          mediaId: 'media_id',
          user: { id: 'user_id' },
        },
      }],
    );

    const [sacrifices] = merge.getSacrifices(characters as any, 'target', 3);

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 1).length,
      20,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 2).length,
      1,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 3).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 4).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 5).length,
      0,
    );

    await assertSnapshot(test, sacrifices);
  });

  await test.step('625 ones', async (test) => {
    const characters = Array(625).fill({}).map((
      _,
      i,
    ) => ({
      value: {
        rating: 1,
        id: `id:${i}`,
        mediaId: 'media_id',
        user: { id: 'user_id' },
      },
    })).concat(
      [{
        value: {
          rating: 4,
          id: `id:20`,
          mediaId: 'media_id',
          user: { id: 'user_id' },
        },
      }],
    );

    const [sacrifices] = merge.getSacrifices(characters as any, 'target', 5);

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 1).length,
      625,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 2).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 3).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 4).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 5).length,
      0,
    );

    await assertSnapshot(test, sacrifices);
  });

  await test.step('500 ones + 5 threes', async (test) => {
    const characters = Array(500).fill({}).map((
      _,
      i,
    ) => ({
      value: {
        rating: 1,
        id: `id:${i}`,
        mediaId: 'media_id',
        user: { id: 'user_id' },
      },
    })).concat(
      Array(25).fill({}).map((
        _,
        i,
      ) => ({
        value: {
          rating: 3,
          id: `id:${i}`,
          mediaId: 'media_id',
          user: { id: 'user_id' },
        },
      })),
    );

    const [sacrifices] = merge.getSacrifices(characters as any, 'target', 5);

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 1).length,
      500,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 2).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 3).length,
      5,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 4).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 5).length,
      0,
    );

    await assertSnapshot(test, sacrifices);
  });

  await test.step('5 fours', async (test) => {
    const characters = Array(25).fill({}).map((
      _,
      i,
    ) => ({
      value: {
        rating: 4,
        id: `id:${i}`,
        mediaId: 'media_id',
        user: { id: 'user_id' },
      },
    }));

    const [sacrifices] = merge.getSacrifices(characters as any, 'target', 5);

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 1).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 2).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 3).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 4).length,
      5,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 5).length,
      0,
    );

    await assertSnapshot(test, sacrifices);
  });

  await test.step('5 fives', async () => {
    const characters = Array(25).fill({}).map((_, i) => ({
      value: {
        rating: 5,
        id: `id:${i}`,
        mediaId: 'media_id',
        user: { id: 'user_id' },
      },
    }));

    const [sacrifices] = merge.getSacrifices(characters as any, 'target', 5);

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 1).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 2).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 3).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 4).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 5).length,
      5,
    );

    await assertSnapshot(test, sacrifices);
  });

  await test.step('4 fours + 1 five', async () => {
    const characters = Array(4).fill({}).map((_, i) => ({
      value: {
        rating: 4,
        id: `id:${i}`,
        mediaId: 'media_id',
        user: { id: 'user_id' },
      },
    }));

    characters.push({
      value: {
        rating: 5,
        id: 'id:4',
        mediaId: 'media_id',
        user: { id: 'user_id' },
      },
    });

    const [sacrifices] = merge.getSacrifices(characters as any, 'target', 5);

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 1).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 2).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 3).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 4).length,
      4,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 5).length,
      1,
    );

    await assertSnapshot(test, sacrifices);
  });

  await test.step('4 fives + 1 four', async () => {
    const characters = Array(4).fill({}).map((_, i) => ({
      value: {
        rating: 5,
        id: `id:${i}`,
        mediaId: 'media_id',
        user: { id: 'user_id' },
      },
    }));

    characters.push({
      value: {
        rating: 4,
        id: 'id:4',
        mediaId: 'media_id',
        user: { id: 'user_id' },
      },
    });

    const [sacrifices] = merge.getSacrifices(characters as any, 'target', 5);

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 1).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 2).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 3).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 4).length,
      1,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 5).length,
      4,
    );

    await assertSnapshot(test, sacrifices);
  });

  await test.step('min', async (test) => {
    const characters = Array(25).fill({}).map((_, i) => ({
      value: {
        rating: 1,
        id: `id:${i}`,
        mediaId: 'media_id',
        user: { id: 'user_id' },
      },
    }));

    const [sacrifices, target] = merge.getSacrifices(characters as any, 'min');

    assertEquals(target, 2);

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 1).length,
      5,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 2).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 3).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 4).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 5).length,
      0,
    );

    await assertSnapshot(test, sacrifices);
  });

  await test.step('max', async (test) => {
    const characters = Array(25).fill({}).map((_, i) => ({
      value: {
        rating: 1,
        id: `id:${i}`,
        mediaId: 'media_id',
        user: { id: 'user_id' },
      },
    }));

    const [sacrifices, target] = merge.getSacrifices(characters as any, 'max');

    assertEquals(target, 3);

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 1).length,
      25,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 2).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 3).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 4).length,
      0,
    );

    assertEquals(
      sacrifices.filter(({ value: char }) => char.rating === 5).length,
      0,
    );

    await assertSnapshot(test, sacrifices);
  });
});

Deno.test('synthesis confirmed', async (test) => {
  await test.step('normal', async () => {
    const media: AniListMedia = {
      id: '2',
      packId: 'anilist',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      popularity: 150_000,
      title: {
        english: 'title',
      },
      coverImage: {
        extraLarge: 'media_image_url',
      },
    };

    const character: AniListCharacter = {
      id: '1',
      packId: 'anilist',
      name: {
        full: 'name',
      },
      image: {
        large: 'character_image_url',
      },
      media: {
        edges: [{
          characterRole: CharacterRole.Supporting,
          node: media,
        }],
      },
    };

    const timeStub = new FakeTime();

    const fetchStub = stub(
      utils,
      'fetchWithRetry',
      returnsNext([
        {
          ok: true,
          text: (() =>
            Promise.resolve(JSON.stringify({
              data: {
                Page: {
                  characters: [character],
                  // media: [media],
                },
              },
            }))),
        } as any,
        undefined,
        undefined,
        undefined,
      ] as any),
    );

    const getGuildStub = stub(
      db,
      'getGuild',
      () => 'guild' as any,
    );

    const getInstanceStub = stub(
      db,
      'getInstance',
      () => 'instance' as any,
    );

    const getInstanceInventoriesStub = stub(
      db,
      'getInstanceInventories',
      () => [] as any,
    );

    const addCharacterStub = stub(
      db,
      'addCharacter',
      () => ({ ok: true }) as any,
    );

    const gachaStub = stub(gacha, 'guaranteedPool', () =>
      Promise.resolve({
        pool: [{ id: 'anilist:1', mediaId: 'anilist:2', rating: 1 }],
        validate: () => true,
      }));

    const synthesisStub = stub(
      merge,
      'getFilteredCharacters',
      () =>
        Promise.resolve([
          {
            value: {
              id: 'anilist:1',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:2',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:3',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:4',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:5',
              rating: 1,
            },
          },
        ] as any),
    );

    config.appId = 'app_id';
    config.origin = 'http://localhost:8000';

    try {
      const message = merge.confirmed({
        token: 'test_token',
        userId: 'user_id',
        guildId: 'guild_id',

        target: 2,
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
          embeds: [{
            type: 'rich',
            image: {
              url: 'http://localhost:8000/assets/stars/2.gif',
            },
          }],
          components: [],
          attachments: [],
        },
      );

      await timeStub.nextAsync();

      assertEquals(
        fetchStub.calls[3].args[0],
        'https://discord.com/api/v10/webhooks/app_id/test_token/messages/@original',
      );

      assertEquals(fetchStub.calls[3].args[1]?.method, 'PATCH');

      assertEquals(
        JSON.parse(
          (fetchStub.calls[3].args[1]?.body as FormData)?.get(
            'payload_json',
          ) as any,
        ),
        {
          attachments: [],
          embeds: [{
            type: 'rich',
            description: new Rating({ stars: 2 }).emotes,
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
                custom_id: 'character=anilist:1=1',
                label: '/character',
                style: 2,
                type: 2,
              },
              {
                custom_id: 'like=anilist:1',
                label: '/like',
                style: 2,
                type: 2,
              },
            ],
          }],
        },
      );

      await timeStub.runMicrotasks();
    } finally {
      delete config.appId;
      delete config.origin;

      fetchStub.restore();
      synthesisStub.restore();
      gachaStub.restore();
      timeStub.restore();

      getGuildStub.restore();
      getInstanceStub.restore();
      getInstanceInventoriesStub.restore();
      addCharacterStub.restore();
    }
  });

  await test.step('liked', async () => {
    const media: AniListMedia = {
      id: '2',
      packId: 'anilist',
      type: MediaType.Anime,
      format: MediaFormat.TV,
      popularity: 150_000,
      title: {
        english: 'title',
      },
      coverImage: {
        extraLarge: 'media_image_url',
      },
    };

    const character: AniListCharacter = {
      id: '1',
      packId: 'anilist',
      name: {
        full: 'name',
      },
      image: {
        large: 'character_image_url',
      },
      media: {
        edges: [{
          characterRole: CharacterRole.Supporting,
          node: media,
        }],
      },
    };

    const timeStub = new FakeTime();

    const fetchStub = stub(
      utils,
      'fetchWithRetry',
      returnsNext([
        {
          ok: true,
          text: (() =>
            Promise.resolve(JSON.stringify({
              data: {
                Page: {
                  characters: [character],
                  // media: [media],
                },
              },
            }))),
        } as any,
        undefined,
        undefined,
        undefined,
        undefined,
      ] as any),
    );

    const getGuildStub = stub(
      db,
      'getGuild',
      () => 'guild' as any,
    );

    const getInstanceStub = stub(
      db,
      'getInstance',
      () => 'instance' as any,
    );

    const getInstanceInventoriesStub = stub(
      db,
      'getInstanceInventories',
      () =>
        [[{}, {
          id: 'another_user_id',
          likes: [{ characterId: 'anilist:1' }],
        }]] as any,
    );

    const addCharacterStub = stub(
      db,
      'addCharacter',
      () => ({ ok: true }) as any,
    );

    const gachaStub = stub(gacha, 'guaranteedPool', () =>
      Promise.resolve({
        pool: [{ id: 'anilist:1', mediaId: 'anilist:2', rating: 1 }],
        validate: () => true,
      }));

    const synthesisStub = stub(
      merge,
      'getFilteredCharacters',
      () =>
        Promise.resolve([
          {
            value: {
              id: 'anilist:1',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:2',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:3',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:4',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:5',
              rating: 1,
            },
          },
        ] as any),
    );

    config.appId = 'app_id';
    config.origin = 'http://localhost:8000';

    try {
      const message = merge.confirmed({
        token: 'test_token',
        userId: 'user_id',
        guildId: 'guild_id',
        target: 2,
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
          embeds: [{
            type: 'rich',
            image: {
              url: 'http://localhost:8000/assets/stars/2.gif',
            },
          }],
          components: [],
          attachments: [],
        },
      );

      await timeStub.nextAsync();

      assertEquals(
        fetchStub.calls[3].args[0],
        'https://discord.com/api/v10/webhooks/app_id/test_token/messages/@original',
      );

      assertEquals(fetchStub.calls[3].args[1]?.method, 'PATCH');

      assertEquals(
        JSON.parse(
          (fetchStub.calls[3].args[1]?.body as FormData)?.get(
            'payload_json',
          ) as any,
        ),
        {
          attachments: [],
          embeds: [{
            type: 'rich',
            description: new Rating({ stars: 2 }).emotes,
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
                custom_id: 'character=anilist:1=1',
                label: '/character',
                style: 2,
                type: 2,
              },
              {
                custom_id: 'like=anilist:1',
                label: '/like',
                style: 2,
                type: 2,
              },
            ],
          }],
        },
      );

      await timeStub.runMicrotasks();

      assertEquals(
        fetchStub.calls[4].args[0],
        'https://discord.com/api/v10/webhooks/app_id/test_token',
      );

      assertEquals(fetchStub.calls[4].args[1]?.method, 'POST');

      assertEquals(
        JSON.parse(
          (fetchStub.calls[4].args[1]?.body as FormData)?.get(
            'payload_json',
          ) as any,
        ),
        {
          components: [],
          attachments: [],
          content: '<@another_user_id>',
          embeds: [
            {
              type: 'rich',
              description:
                '<@user_id>\n\n<:star:1061016362832642098><:star:1061016362832642098><:no_star:1109377526662434906><:no_star:1109377526662434906><:no_star:1109377526662434906>',
              fields: [
                {
                  name: 'title',
                  value: '**name**',
                },
              ],
              thumbnail: {
                url:
                  'http://localhost:8000/external/character_image_url?size=thumbnail',
              },
            },
          ],
        },
      );
    } finally {
      delete config.appId;
      delete config.origin;

      fetchStub.restore();
      synthesisStub.restore();
      gachaStub.restore();
      timeStub.restore();

      getGuildStub.restore();
      getInstanceStub.restore();
      getInstanceInventoriesStub.restore();
      addCharacterStub.restore();
    }
  });

  await test.step('not enough sacrifices', async () => {
    const timeStub = new FakeTime();

    const fetchStub = stub(utils, 'fetchWithRetry', () => undefined as any);

    const synthesisStub = stub(
      merge,
      'getFilteredCharacters',
      () =>
        Promise.resolve([
          {
            value: {
              id: 'anilist:1',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:2',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:3',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:4',
              rating: 1,
            },
          },
        ] as any),
    );

    config.appId = 'app_id';
    config.origin = 'http://localhost:8000';

    try {
      const message = merge.confirmed({
        token: 'test_token',
        userId: 'user_id',
        guildId: 'guild_id',

        target: 2,
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
            description:
              'You only have **4 out the 5** sacrifices needed for 2<:smolstar:1107503653956374638>',
          }],
          components: [],
          attachments: [],
        },
      );
    } finally {
      delete config.appId;
      delete config.origin;

      fetchStub.restore();
      synthesisStub.restore();
      timeStub.restore();
    }
  });

  await test.step('pool error', async () => {
    const timeStub = new FakeTime();

    const fetchStub = stub(
      utils,
      'fetchWithRetry',
      () => undefined as any,
    );

    const gachaStub = stub(
      gacha,
      'rngPull',
      () =>
        Promise.reject(
          new PoolError(),
        ),
    );

    const synthesisStub = stub(
      merge,
      'getFilteredCharacters',
      () =>
        Promise.resolve([
          {
            value: {
              id: 'anilist:1',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:2',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:3',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:4',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:5',
              rating: 1,
            },
          },
        ] as any),
    );

    config.appId = 'app_id';
    config.origin = 'http://localhost:8000';

    try {
      const message = merge.confirmed({
        token: 'test_token',
        userId: 'user_id',
        guildId: 'guild_id',

        target: 2,
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
            description:
              'There are no more 2<:smolstar:1107503653956374638>characters left',
          }],
          components: [],
          attachments: [],
        },
      );
    } finally {
      delete config.appId;
      delete config.origin;

      fetchStub.restore();
      synthesisStub.restore();
      gachaStub.restore();
      timeStub.restore();
    }
  });
});

Deno.test('/merge', async (test) => {
  await test.step('normal', async () => {
    const characters: AniListCharacter[] = [
      {
        id: '1',
        name: {
          full: 'character 1',
        },
        image: {
          large: 'image_url',
        },
        media: {
          edges: [{
            characterRole: CharacterRole.Main,
            node: {
              id: 'anime',
              type: MediaType.Anime,
              title: {
                english: 'media title',
              },
            },
          }],
        },
      },
      {
        id: '2',
        name: {
          full: 'character 2',
        },
        image: {
          large: 'image_url',
        },
        media: {
          edges: [{
            characterRole: CharacterRole.Main,
            node: {
              id: 'anime',
              type: MediaType.Anime,
              title: {
                english: 'media title',
              },
            },
          }],
        },
      },
      {
        id: '3',
        name: {
          full: 'character 3',
        },
        image: {
          large: 'image_url',
        },
        media: {
          edges: [{
            characterRole: CharacterRole.Main,
            node: {
              id: 'anime',
              type: MediaType.Anime,
              title: {
                english: 'media title',
              },
            },
          }],
        },
      },
      {
        id: '4',
        name: {
          full: 'character 4',
        },
        image: {
          large: 'image_url',
        },
      },
      {
        id: '5',
        name: {
          full: 'character 5',
        },
        image: {
          large: 'image_url',
        },
      },
    ];

    const timeStub = new FakeTime();

    const fetchStub = stub(
      utils,
      'fetchWithRetry',
      returnsNext([
        {
          ok: true,
          text: (() =>
            Promise.resolve(JSON.stringify({
              data: {
                Page: {
                  characters,
                },
              },
            }))),
        } as any,
        undefined,
      ]),
    );

    const getUserStub = stub(
      db,
      'getUser',
      () => 'user' as any,
    );

    const getGuildStub = stub(
      db,
      'getGuild',
      () => 'guild' as any,
    );

    const getInstanceStub = stub(
      db,
      'getInstance',
      () => 'instance' as any,
    );

    const getInventoryStub = stub(
      db,
      'getInventory',
      () => ({ inventory: 'inventory' }) as any,
    );

    const getUserPartyStub = stub(
      db,
      'getUserParty',
      () => ({}) as any,
    );

    const getUserCharactersStub = stub(
      db,
      'getUserCharacters',
      () =>
        [
          {
            value: {
              id: 'anilist:1',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:2',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:3',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:4',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:5',
              rating: 1,
            },
          },
        ] as any,
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    const isDisabledStub = stub(packs, 'isDisabled', () => false);

    config.synthesis = true;
    config.appId = 'app_id';
    config.origin = 'http://localhost:8000';

    try {
      const message = await merge.synthesize({
        token: 'test_token',
        userId: 'user_id',
        guildId: 'guild_id',
        mode: 'target',
        target: 2,
      });

      assertEquals(message.json(), {
        type: 4,
        data: {
          attachments: [],
          components: [],
          embeds: [{
            type: 'rich',
            image: {
              url: 'http://localhost:8000/assets/spinner3.gif',
            },
          }],
        },
      });

      await timeStub.runMicrotasks();

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
          attachments: [],
          components: [{
            type: 1,
            components: [
              {
                custom_id: 'synthesis=user_id=2',
                label: 'Confirm',
                style: 2,
                type: 2,
              },
              {
                custom_id: 'cancel=user_id',
                label: 'Cancel',
                style: 4,
                type: 2,
              },
            ],
          }],
          embeds: [
            {
              type: 'rich',
              description: 'Sacrifice **5** characters?',
            },
            {
              type: 'rich',
              fields: [
                {
                  name: 'media title',
                  value: '1<:smolstar:1107503653956374638>character 1',
                },
              ],
              thumbnail: {
                url: 'http://localhost:8000/external/image_url?size=preview',
              },
            },
            {
              type: 'rich',
              fields: [
                {
                  name: 'media title',
                  value: '1<:smolstar:1107503653956374638>character 2',
                },
              ],
              thumbnail: {
                url: 'http://localhost:8000/external/image_url?size=preview',
              },
            },
            {
              type: 'rich',
              fields: [
                {
                  name: 'media title',
                  value: '1<:smolstar:1107503653956374638>character 3',
                },
              ],
              thumbnail: {
                url: 'http://localhost:8000/external/image_url?size=preview',
              },
            },
            {
              type: 'rich',
              description: '1<:smolstar:1107503653956374638>character 4',
              thumbnail: {
                url: 'http://localhost:8000/external/image_url?size=preview',
              },
            },
            {
              type: 'rich',
              description: '1<:smolstar:1107503653956374638>character 5',
              thumbnail: {
                url: 'http://localhost:8000/external/image_url?size=preview',
              },
            },
          ],
        },
      );
    } finally {
      delete config.appId;
      delete config.origin;
      delete config.synthesis;

      fetchStub.restore();
      listStub.restore();
      isDisabledStub.restore();
      timeStub.restore();

      getUserStub.restore();
      getGuildStub.restore();
      getInstanceStub.restore();
      getInventoryStub.restore();
      getUserPartyStub.restore();
      getUserCharactersStub.restore();
    }
  });

  await test.step('with nicknames', async () => {
    const characters: AniListCharacter[] = [
      {
        id: '1',
        name: {
          full: 'character 1',
        },
        image: {
          large: 'image_url',
        },
      },
      {
        id: '2',
        name: {
          full: 'character 2',
        },
        image: {
          large: 'image_url',
        },
      },
      {
        id: '3',
        name: {
          full: 'character 3',
        },
        image: {
          large: 'image_url',
        },
      },
      {
        id: '4',
        name: {
          full: 'character 4',
        },
        image: {
          large: 'image_url',
        },
      },
      {
        id: '5',
        name: {
          full: 'character 5',
        },
        image: {
          large: 'image_url',
        },
      },
    ];

    const timeStub = new FakeTime();

    const fetchStub = stub(
      utils,
      'fetchWithRetry',
      returnsNext([
        {
          ok: true,
          text: (() =>
            Promise.resolve(JSON.stringify({
              data: {
                Page: {
                  characters,
                },
              },
            }))),
        } as any,
        undefined,
      ]),
    );

    const getUserStub = stub(
      db,
      'getUser',
      () => 'user' as any,
    );

    const getGuildStub = stub(
      db,
      'getGuild',
      () => 'guild' as any,
    );

    const getInstanceStub = stub(
      db,
      'getInstance',
      () => 'instance' as any,
    );

    const getInventoryStub = stub(
      db,
      'getInventory',
      () => ({ inventory: 'inventory' }) as any,
    );

    const getUserPartyStub = stub(
      db,
      'getUserParty',
      () => ({}) as any,
    );

    const getUserCharactersStub = stub(
      db,
      'getUserCharacters',
      () =>
        [
          {
            value: {
              image: 'custom_image_url',
              nickname: 'nickname 1',
              id: 'anilist:1',
              rating: 1,
            },
          },
          {
            value: {
              image: 'custom_image_url',
              nickname: 'nickname 2',
              id: 'anilist:2',
              rating: 1,
            },
          },
          {
            value: {
              image: 'custom_image_url',
              nickname: 'nickname 3',
              id: 'anilist:3',
              rating: 1,
            },
          },
          {
            value: {
              image: 'custom_image_url',
              nickname: 'nickname 4',
              id: 'anilist:4',
              rating: 1,
            },
          },
          {
            value: {
              image: 'custom_image_url',
              nickname: 'nickname 5',
              id: 'anilist:5',
              rating: 1,
            },
          },
        ] as any,
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    const isDisabledStub = stub(packs, 'isDisabled', () => false);

    config.synthesis = true;
    config.appId = 'app_id';
    config.origin = 'http://localhost:8000';

    try {
      const message = await merge.synthesize({
        token: 'test_token',
        userId: 'user_id',
        guildId: 'guild_id',
        mode: 'target',
        target: 2,
      });

      assertEquals(message.json(), {
        type: 4,
        data: {
          attachments: [],
          components: [],
          embeds: [{
            type: 'rich',
            image: {
              url: 'http://localhost:8000/assets/spinner3.gif',
            },
          }],
        },
      });

      await timeStub.runMicrotasks();

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
          attachments: [],
          components: [{
            type: 1,
            components: [
              {
                custom_id: 'synthesis=user_id=2',
                label: 'Confirm',
                style: 2,
                type: 2,
              },
              {
                custom_id: 'cancel=user_id',
                label: 'Cancel',
                style: 4,
                type: 2,
              },
            ],
          }],
          embeds: [
            {
              type: 'rich',
              description: 'Sacrifice **5** characters?',
            },
            {
              type: 'rich',
              description: '1<:smolstar:1107503653956374638>nickname 1',
              thumbnail: {
                url:
                  'http://localhost:8000/external/custom_image_url?size=preview',
              },
            },
            {
              type: 'rich',
              description: '1<:smolstar:1107503653956374638>nickname 2',
              thumbnail: {
                url:
                  'http://localhost:8000/external/custom_image_url?size=preview',
              },
            },
            {
              type: 'rich',
              description: '1<:smolstar:1107503653956374638>nickname 3',
              thumbnail: {
                url:
                  'http://localhost:8000/external/custom_image_url?size=preview',
              },
            },
            {
              type: 'rich',
              description: '1<:smolstar:1107503653956374638>nickname 4',
              thumbnail: {
                url:
                  'http://localhost:8000/external/custom_image_url?size=preview',
              },
            },
            {
              type: 'rich',
              description: '1<:smolstar:1107503653956374638>nickname 5',
              thumbnail: {
                url:
                  'http://localhost:8000/external/custom_image_url?size=preview',
              },
            },
          ],
        },
      );
    } finally {
      delete config.appId;
      delete config.origin;
      delete config.synthesis;

      fetchStub.restore();
      listStub.restore();
      isDisabledStub.restore();
      timeStub.restore();

      getUserStub.restore();
      getGuildStub.restore();
      getInstanceStub.restore();
      getInventoryStub.restore();
      getUserPartyStub.restore();
      getUserCharactersStub.restore();
    }
  });

  await test.step('disabled characters', async () => {
    const characters: AniListCharacter[] = [
      {
        id: '1',
        name: {
          full: 'character 1',
        },
        image: {
          large: 'image_url',
        },
      },
      {
        id: '2',
        name: {
          full: 'character 2',
        },
        image: {
          large: 'image_url',
        },
      },
      {
        id: '3',
        name: {
          full: 'character 3',
        },
        image: {
          large: 'image_url',
        },
      },
      {
        id: '4',
        name: {
          full: 'character 4',
        },
        image: {
          large: 'image_url',
        },
      },
      {
        id: '5',
        name: {
          full: 'character 5',
        },
        image: {
          large: 'image_url',
        },
      },
    ];

    const timeStub = new FakeTime();

    const fetchStub = stub(
      utils,
      'fetchWithRetry',
      returnsNext([
        {
          ok: true,
          text: (() =>
            Promise.resolve(JSON.stringify({
              data: {
                Page: {
                  characters,
                },
              },
            }))),
        } as any,
        undefined,
      ]),
    );

    const getUserStub = stub(
      db,
      'getUser',
      () => 'user' as any,
    );

    const getGuildStub = stub(
      db,
      'getGuild',
      () => 'guild' as any,
    );

    const getInstanceStub = stub(
      db,
      'getInstance',
      () => 'instance' as any,
    );

    const getInventoryStub = stub(
      db,
      'getInventory',
      () => ({ inventory: 'inventory' }) as any,
    );

    const getUserPartyStub = stub(
      db,
      'getUserParty',
      () => ({}) as any,
    );

    const getUserCharactersStub = stub(
      db,
      'getUserCharacters',
      () =>
        [
          {
            value: {
              id: 'anilist:1',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:2',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:3',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:4',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:5',
              rating: 1,
            },
          },
        ] as any,
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    const isDisabledStub = stub(
      packs,
      'isDisabled',
      (id) => id === 'anilist:1' || id === 'anilist:2',
    );

    config.appId = 'app_id';
    config.origin = 'http://localhost:8000';
    config.synthesis = true;

    try {
      const message = await merge.synthesize({
        token: 'test_token',
        userId: 'user_id',
        guildId: 'guild_id',
        mode: 'target',
        target: 2,
      });

      assertEquals(message.json(), {
        type: 4,
        data: {
          attachments: [],
          components: [],
          embeds: [{
            type: 'rich',
            image: {
              url: 'http://localhost:8000/assets/spinner3.gif',
            },
          }],
        },
      });

      await timeStub.runMicrotasks();

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
          attachments: [],
          components: [{
            type: 1,
            components: [
              {
                custom_id: 'synthesis=user_id=2',
                label: 'Confirm',
                style: 2,
                type: 2,
              },
              {
                custom_id: 'cancel=user_id',
                label: 'Cancel',
                style: 4,
                type: 2,
              },
            ],
          }],
          embeds: [
            {
              type: 'rich',
              description: 'Sacrifice **5** characters?',
            },
            {
              type: 'rich',
              description: '1<:smolstar:1107503653956374638>character 3',
              thumbnail: {
                url: 'http://localhost:8000/external/image_url?size=preview',
              },
            },
            {
              type: 'rich',
              description: '1<:smolstar:1107503653956374638>character 4',
              thumbnail: {
                url: 'http://localhost:8000/external/image_url?size=preview',
              },
            },
            {
              type: 'rich',
              description: '1<:smolstar:1107503653956374638>character 5',
              thumbnail: {
                url: 'http://localhost:8000/external/image_url?size=preview',
              },
            },
            {
              type: 'rich',
              description: '_+2 others..._',
            },
          ],
        },
      );
    } finally {
      delete config.appId;
      delete config.origin;
      delete config.synthesis;

      fetchStub.restore();
      listStub.restore();
      isDisabledStub.restore();
      timeStub.restore();

      getUserStub.restore();
      getGuildStub.restore();
      getInstanceStub.restore();
      getInventoryStub.restore();
      getUserPartyStub.restore();
      getUserCharactersStub.restore();
    }
  });

  await test.step('filter (party)', async () => {
    const fetchStub = stub(
      utils,
      'fetchWithRetry',
      returnsNext([
        undefined,
      ] as any),
    );

    const getUserStub = stub(
      db,
      'getUser',
      () => 'user' as any,
    );

    const getGuildStub = stub(
      db,
      'getGuild',
      () => 'guild' as any,
    );

    const getInstanceStub = stub(
      db,
      'getInstance',
      () => 'instance' as any,
    );

    const getInventoryStub = stub(
      db,
      'getInventory',
      () => ({ inventory: 'inventory' }) as any,
    );

    const getUserPartyStub = stub(
      db,
      'getUserParty',
      () =>
        ({
          member1: {
            id: 'anilist:1',
          },
          member2: {
            id: 'anilist:2',
          },
          member3: {
            id: 'anilist:3',
          },
          member4: {
            id: 'anilist:4',
          },
          member5: {
            id: 'anilist:5',
          },
        }) as any,
    );

    const getUserCharactersStub = stub(
      db,
      'getUserCharacters',
      () =>
        [
          {
            value: {
              id: 'anilist:1',
              mediaId: 'pack-id:1',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:2',
              mediaId: 'pack-id:1',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:3',
              mediaId: 'pack-id:1',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:4',
              mediaId: 'pack-id:1',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:5',
              mediaId: 'pack-id:2',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:6',
              mediaId: 'pack-id:1',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:7',
              mediaId: 'pack-id:1',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:8',
              mediaId: 'pack-id:1',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:9',
              mediaId: 'pack-id:1',
              rating: 1,
            },
          },
        ] as any,
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    config.synthesis = true;

    try {
      await assertRejects(
        () =>
          merge.synthesize({
            token: 'test_token',
            userId: 'user_id',
            guildId: 'guild_id',
            mode: 'target',
            target: 2,
          }),
        NonFetalError,
        'You only have **4 out the 5** sacrifices needed for 2<:smolstar:1107503653956374638>',
      );
    } finally {
      delete config.synthesis;

      fetchStub.restore();
      listStub.restore();

      getUserStub.restore();
      getGuildStub.restore();
      getInstanceStub.restore();
      getInventoryStub.restore();
      getUserPartyStub.restore();
      getUserCharactersStub.restore();
    }
  });

  await test.step('filter (liked characters)', async () => {
    const fetchStub = stub(
      utils,
      'fetchWithRetry',
      returnsNext([
        undefined,
      ] as any),
    );

    const getUserStub = stub(
      db,
      'getUser',
      () =>
        ({
          likes: [
            { characterId: 'anilist:1' },
            { characterId: 'anilist:2' },
            { characterId: 'anilist:3' },
            { characterId: 'anilist:4' },
            { characterId: 'anilist:5' },
          ],
        }) as any,
    );

    const getGuildStub = stub(
      db,
      'getGuild',
      () => 'guild' as any,
    );

    const getInstanceStub = stub(
      db,
      'getInstance',
      () => 'instance' as any,
    );

    const getInventoryStub = stub(
      db,
      'getInventory',
      () => ({ inventory: 'inventory' }) as any,
    );

    const getUserPartyStub = stub(
      db,
      'getUserParty',
      () => ({}) as any,
    );

    const getUserCharactersStub = stub(
      db,
      'getUserCharacters',
      () =>
        [
          {
            value: {
              id: 'anilist:1',
              mediaId: 'pack-id:1',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:2',
              mediaId: 'pack-id:1',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:3',
              mediaId: 'pack-id:1',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:4',
              mediaId: 'pack-id:1',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:5',
              mediaId: 'pack-id:2',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:6',
              mediaId: 'pack-id:1',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:7',
              mediaId: 'pack-id:1',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:8',
              mediaId: 'pack-id:1',
              rating: 1,
            },
          },
          {
            value: {
              id: 'anilist:9',
              mediaId: 'pack-id:1',
              rating: 1,
            },
          },
        ] as any,
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    config.synthesis = true;

    try {
      await assertRejects(
        () =>
          merge.synthesize({
            token: 'test_token',
            userId: 'user_id',
            guildId: 'guild_id',
            mode: 'target',
            target: 2,
          }),
        NonFetalError,
        'You only have **4 out the 5** sacrifices needed for 2<:smolstar:1107503653956374638>',
      );
    } finally {
      delete config.synthesis;

      fetchStub.restore();
      listStub.restore();

      getUserStub.restore();
      getGuildStub.restore();
      getInstanceStub.restore();
      getInventoryStub.restore();
      getUserPartyStub.restore();
      getUserCharactersStub.restore();
    }
  });

  await test.step('not enough', async () => {
    const fetchStub = stub(
      utils,
      'fetchWithRetry',
      returnsNext([
        {
          ok: true,
          text: (() =>
            Promise.resolve(JSON.stringify({
              data: {
                getUserInventory: {
                  user: {},
                  characters: [],
                },
              },
            }))),
        } as any,
        undefined,
      ]),
    );

    const getUserStub = stub(
      db,
      'getUser',
      () => 'user' as any,
    );

    const getGuildStub = stub(
      db,
      'getGuild',
      () => 'guild' as any,
    );

    const getInstanceStub = stub(
      db,
      'getInstance',
      () => 'instance' as any,
    );

    const getInventoryStub = stub(
      db,
      'getInventory',
      () => ({ inventory: 'inventory' }) as any,
    );

    const getUserPartyStub = stub(
      db,
      'getUserParty',
      () => ({}) as any,
    );

    const getUserCharactersStub = stub(
      db,
      'getUserCharacters',
      () => [] as any,
    );

    const listStub = stub(
      packs,
      'all',
      () => Promise.resolve([]),
    );

    config.synthesis = true;

    try {
      await assertRejects(
        () =>
          merge.synthesize({
            token: 'test_token',
            userId: 'user_id',
            guildId: 'guild_id',
            mode: 'target',
            target: 5,
          }),
        NonFetalError,
        'You only have **0 out the 5** sacrifices needed for 5<:smolstar:1107503653956374638>',
      );
    } finally {
      delete config.synthesis;

      fetchStub.restore();
      listStub.restore();

      getUserStub.restore();
      getGuildStub.restore();
      getInstanceStub.restore();
      getInventoryStub.restore();
      getUserPartyStub.restore();
      getUserCharactersStub.restore();
    }
  });

  await test.step('under maintenance', async () => {
    config.synthesis = false;

    try {
      await assertRejects(
        () =>
          merge.synthesize({
            token: 'test_token',
            userId: 'user_id',
            guildId: 'guild_id',
            mode: 'target',
            target: 2,
          }),
        NonFetalError,
        'Merging is under maintenance, try again later!',
      );
    } finally {
      delete config.synthesis;
    }
  });
});
