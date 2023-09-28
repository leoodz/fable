import '#filter-boolean';

import _anilistManifest from '../packs/anilist/manifest.json' assert {
  type: 'json',
};

import _vtubersManifest from '../packs/vtubers/manifest.json' assert {
  type: 'json',
};

import * as _anilist from '../packs/anilist/index.ts';

import * as discord from './discord.ts';

import user from './user.ts';
import utils from './utils.ts';

import i18n from './i18n.ts';

import config from './config.ts';

import db from '../db/mod.ts';

import Rating from './rating.ts';

import {
  Alias,
  Character,
  CharacterRole,
  DisaggregatedCharacter,
  DisaggregatedMedia,
  Manifest,
  Media,
  MediaFormat,
  MediaRelation,
  Pool,
} from './types.ts';

import { NonFetalError } from './errors.ts';

import type { AniListMedia } from '../packs/anilist/types.ts';

import type { Pack } from '../db/schema.ts';

const anilistManifest = _anilistManifest as Manifest;
const vtubersManifest = _vtubersManifest as Manifest;

type AnilistSearchOptions = {
  page: number;
  perPage: number;
};

const cachedGuilds: Record<string, {
  packs: Pack[];
  disables: string[];
}> = {};

const packs = {
  aggregate,
  aliasToArray,
  all,
  cachedGuilds,
  characters,
  formatToString,
  install,
  isDisabled,
  media,
  mediaCharacters,
  mediaToString,
  packEmbed,
  pages,
  pool,
  searchMany,
  uninstall,
  uninstallDialog,
};

async function all(
  { guildId, filter }: { guildId?: string; filter?: boolean },
): Promise<(Pack[])> {
  const builtins: Pack[] = [
    { manifest: anilistManifest, _id: '_' },
    { manifest: vtubersManifest, _id: '_' },
  ];

  if (!guildId || !config.communityPacks) {
    if (filter) {
      return [];
    }

    return builtins;
  }

  if (guildId in packs.cachedGuilds) {
    if (filter) {
      return packs.cachedGuilds[guildId].packs;
    }

    return [...builtins, ...packs.cachedGuilds[guildId].packs];
  }

  const guild = await db.getGuild(guildId);
  const instance = await db.getInstance(guild);

  const _packs = await db.getInstancePacks(instance);

  packs.cachedGuilds[guildId] = {
    packs: _packs,
    disables: Array.from(
      new Set(
        _packs
          .map((pack) => pack.manifest.conflicts ?? [])
          .flat(),
      ),
    ),
  };

  if (filter) {
    return _packs;
  }

  return [...builtins, ..._packs];
}

function isDisabled(id: string, guildId: string): boolean {
  const disables = [
    // deno-lint-ignore no-non-null-assertion
    ...vtubersManifest.conflicts!,
  ];

  if (guildId in packs.cachedGuilds) {
    disables.push(...packs.cachedGuilds[guildId].disables);
  }

  return disables.includes(id);
}

function packEmbed(pack: Pack): discord.Embed {
  const embed = new discord.Embed()
    .setFooter({ text: pack.manifest.author })
    .setDescription(pack.manifest.description)
    .setThumbnail({
      url: pack.manifest.image,
      default: false,
      proxy: false,
    })
    .setTitle(pack.manifest.title ?? pack.manifest.id);

  return embed;
}

function uninstallDialog(
  { pack, userId }: { pack: Pack; userId: string },
): discord.Message {
  const locale = user.cachedUsers[userId]?.locale;

  const message = new discord.Message()
    .addEmbed(packEmbed(pack));

  return discord.Message.dialog({
    userId,
    message,
    type: 'uninstall',
    confirm: discord.join(pack.manifest.id, userId),
    description: i18n.get('uninstall-pack-confirmation', locale),
  });
}

async function pages(
  { index, userId, guildId }: {
    index: number;
    guildId: string;
    userId: string;
  },
): Promise<discord.Message> {
  const locale = user.cachedUsers[userId]?.locale;

  if (!config.communityPacks) {
    throw new NonFetalError(
      i18n.get('maintenance-packs', locale),
    );
  }

  const list = (await packs.all({ guildId })).toReversed();

  const pack = list[index];

  if (!pack) {
    throw new NonFetalError(i18n.get('pack-doesnt-exist', locale));
  }

  const embed = packEmbed(pack);

  const message = new discord.Message()
    .addEmbed(embed);

  if (pack.manifest.url) {
    message.addComponents([
      new discord.Component()
        .setLabel(i18n.get('homepage', locale))
        .setUrl(pack.manifest.url),
    ]);
  }

  return discord.Message.page({
    index,
    type: 'packs',
    total: list.length,
    next: list.length > index + 1,
    message,
    locale,
  });
}

async function install(
  { id, guildId, userId }: { id: string; guildId: string; userId: string },
): Promise<discord.Message> {
  const locale = user.cachedUsers[userId]?.locale;

  if (!config.communityPacks) {
    throw new NonFetalError(
      i18n.get('maintenance-packs', locale),
    );
  }

  const guild = await db.getGuild(guildId);
  const instance = await db.getInstance(guild);

  try {
    const pack = await db.addPack(instance, userId, id);

    // clear guild cache after uninstall
    delete cachedGuilds[guildId];

    const message = new discord.Message()
      .addEmbed(new discord.Embed().setDescription(
        i18n.get('installed', locale),
      ))
      .addEmbed(packEmbed(pack));

    return message;
  } catch (err) {
    switch (err.message) {
      case 'PACK_PRIVATE':
        throw new NonFetalError(
          i18n.get('pack-is-private', locale),
        );
      case 'PACK_NOT_FOUND':
        throw new Error('404');
      default:
        throw err;
    }
  }
}

async function uninstall(
  { guildId, userId, id }: { guildId: string; userId: string; id: string },
): Promise<discord.Message> {
  const locale = user.cachedUsers[userId]?.locale;

  if (!config.communityPacks) {
    throw new NonFetalError(
      i18n.get('maintenance-packs', locale),
    );
  }

  const guild = await db.getGuild(guildId);
  const instance = await db.getInstance(guild);

  try {
    const pack = await db.removePack(instance, id);

    // clear guild cache after uninstall
    delete cachedGuilds[guildId];

    const message = new discord.Message()
      .addEmbed(new discord.Embed().setDescription(
        i18n.get('uninstalled', locale),
      ))
      .addEmbed(
        new discord.Embed().setDescription(
          i18n.get('pack-characters-disabled', locale),
        ),
      )
      .addEmbed(packEmbed(pack));

    return message;
  } catch (err) {
    switch (err.message) {
      case 'PACK_NOT_FOUND':
      case 'PACK_NOT_INSTALLED':
        throw new Error('404');
      default:
        throw err;
    }
  }

  // if (response.ok) {
  //   // clear guild cache after uninstall
  //   delete cachedGuilds[guildId];

  //   return new discord.Message()
  //     .addEmbed(new discord.Embed().setDescription('Uninstalled'))
  //     .addEmbed(
  //       new discord.Embed().setDescription(
  //         '**All characters from this pack are now disabled**',
  //       ),
  //     )
  //     .addEmbed(packEmbed({ ref: response.uninstall }));
  // } else {
  //   switch (response.error) {
  //     case 'PACK_NOT_FOUND':
  //     case 'PACK_NOT_INSTALLED':
  //       throw new Error('404');
  //     default:
  //       throw new Error(response.error);
  //   }
  // }
}

function parseId(
  literal: string,
  defaultPackId?: string,
): [string | undefined, string | undefined] {
  const split = /^([-_a-z0-9]+):([-_a-z0-9]+)$/.exec(literal);

  if (split?.length === 3) {
    const [, packId, id] = split;
    return [packId, id];
  } else if (defaultPackId && /^([-_a-z0-9]+)$/.test(literal)) {
    return [defaultPackId, literal];
  }

  return [undefined, undefined];
}

async function findById<T>(
  { key, ids, guildId, anilistOptions, defaultPackId }: {
    key: 'media' | 'characters';
    ids: string[];
    guildId: string;
    anilistOptions?: AnilistSearchOptions;
    defaultPackId?: string;
  },
): Promise<{ [key: string]: T }> {
  const anilistIds: number[] = [];

  const results: { [key: string]: T } = {};

  const list = await packs.all({ guildId });

  for (const literal of [...new Set(ids)]) {
    const [packId, id] = parseId(literal, defaultPackId);

    if (!packId || !id) {
      continue;
    }

    if (packId === 'anilist') {
      const n = utils.parseInt(id);

      if (typeof n === 'number') {
        anilistIds.push(n);
      }
    } else {
      const pack = list.find(({ manifest }) => manifest.id === packId);

      // search for the id in packs
      const match = (pack?.manifest[key]?.new as Array<
        DisaggregatedCharacter | DisaggregatedMedia
      >)?.find((m) => m.id === id);

      if (match) {
        results[literal] = (match.packId = packId, match) as T;
      }
    }
  }

  // request the ids from anilist
  const anilistResults = await _anilist[key](
    { ids: anilistIds, ...anilistOptions },
  );

  anilistIds.forEach((n) => {
    const i = anilistResults.findIndex((r) => `${r.id}` === `${n}`);

    if (i > -1) {
      results[`anilist:${n}`] = _anilist.transform<T>({
        item: anilistResults[i],
      });
    }
  });

  return results;
}

async function searchMany<
  T extends (Media | DisaggregatedMedia | Character | DisaggregatedCharacter),
>(
  { key, search, guildId, anilistOptions, threshold }: {
    key: 'media' | 'characters';
    search: string;
    guildId: string;
    anilistOptions?: AnilistSearchOptions;
    threshold?: number;
  },
): Promise<T[]> {
  threshold = threshold ?? 65;

  const percentages: Set<number> = new Set();

  const possibilities: { [percentage: number]: T[] } = {};

  const anilistPack: Manifest = {
    id: 'anilist',
    [key]: {
      new: (await _anilist[key]({ search, ...anilistOptions })).map((item) =>
        _anilist.transform({ item })
      ),
    },
  };

  const list = await packs.all({ guildId });

  for (
    const pack of [
      anilistPack,
      ...list.map(({ manifest }) => manifest),
    ]
  ) {
    for (const item of pack[key]?.new ?? []) {
      const all = packs.aliasToArray(
        'name' in item ? item.name : item.title,
      ).map((alias) => utils.distance(search, alias));

      if (!all.length) {
        return [];
      }

      const percentage = Math.max(...all);

      if (percentage < threshold) {
        continue;
      }

      if (!possibilities[percentage]) {
        possibilities[percentage] = (percentages.add(percentage), []);
      }

      possibilities[percentage]
        .push((item.packId = pack.id, item) as T);
    }
  }

  const sorted = [...percentages]
    .sort((a, b) => b - a);

  let output: T[] = [];

  for (const i of sorted) {
    output = output.concat(
      possibilities[i].sort((a, b) =>
        (b.popularity || 0) - (a.popularity || 0)
      ),
    );
  }

  return output;
}

async function searchOne<
  T extends (Media | DisaggregatedMedia | Character | DisaggregatedCharacter),
>(
  { key, search, guildId, anilistOptions }: {
    key: 'media' | 'characters';
    search: string;
    guildId: string;
    anilistOptions?: AnilistSearchOptions;
  },
): Promise<T | undefined> {
  const possibilities = await searchMany<T>({
    key,
    search,
    guildId,
    anilistOptions,
  });

  return possibilities?.[0];
}

async function media({ ids, search, guildId, anilistOptions }: {
  ids?: string[];
  search?: string;
  guildId: string;
  anilistOptions?: AnilistSearchOptions;
}): Promise<(Media | DisaggregatedMedia)[]> {
  if (ids?.length) {
    // remove duplicates
    ids = Array.from(new Set(ids));

    const results = await findById<Media | DisaggregatedMedia>(
      {
        ids,
        guildId,
        key: 'media',
        anilistOptions,
      },
    );

    return Object.values(results);
  } else if (search) {
    const match: Media | DisaggregatedMedia | undefined = await searchOne(
      { key: 'media', search, guildId, anilistOptions },
    );

    return match ? [match] : [];
  } else {
    return [];
  }
}

async function characters({ ids, search, guildId }: {
  ids?: string[];
  search?: string;
  guildId: string;
}): Promise<(Character | DisaggregatedCharacter)[]> {
  if (ids?.length) {
    // remove duplicates
    ids = Array.from(new Set(ids));

    const results = await findById<Character | DisaggregatedCharacter>(
      {
        ids,
        guildId,
        key: 'characters',
      },
    );

    return Object.values(results);
  } else if (search) {
    const match: Character | DisaggregatedCharacter | undefined =
      await searchOne(
        { key: 'characters', search, guildId },
      );

    return match ? [match] : [];
  } else {
    return [];
  }
}

async function mediaCharacters({ id, search, guildId, index }: {
  id?: string;
  search?: string;
  guildId: string;
  index: number;
}): Promise<
  {
    media?: Media | DisaggregatedMedia;
    role?: CharacterRole;
    character?: DisaggregatedCharacter;
    total?: number;
    next: boolean;
  }
> {
  const results: (Media | DisaggregatedMedia)[] = await packs
    .media(
      id
        ? {
          guildId,
          ids: [id],
          anilistOptions: {
            perPage: 1,
            page: index + 1,
          },
        }
        : {
          search,
          guildId,
          anilistOptions: {
            perPage: 1,
            page: index + 1,
          },
        },
    );

  if (!results.length) {
    throw new Error('404');
  }

  if (results[0].packId === 'anilist') {
    return {
      next: Boolean(
        (results[0] as AniListMedia).characters?.pageInfo.hasNextPage,
      ),
      media: results[0] as AniListMedia,
      role: (results[0] as AniListMedia).characters?.edges?.[0].role,
      character: (results[0] as AniListMedia).characters?.edges?.[0]
        ?.node as DisaggregatedCharacter,
    };
  } else {
    const total = (results[0] as DisaggregatedMedia).characters?.length || 0;

    const media = await aggregate<Media>({
      media: results[0],
      start: index,
      end: 1,
      guildId,
    });

    return {
      total,
      media,
      role: media.characters?.edges?.[0]?.role,
      character: media.characters?.edges?.[0]?.node as DisaggregatedCharacter,
      next: index + 1 < total,
    };
  }
}

async function aggregate<T>({ media, character, start, end, guildId }: {
  media?: Media | DisaggregatedMedia;
  character?: Character | DisaggregatedCharacter;
  start?: number;
  end?: number;
  guildId: string;
}): Promise<T> {
  start = start || 0;

  if (end) {
    end = start + (end || 1);
  }

  if (media) {
    if (
      (media.relations && 'edges' in media.relations) ||
      (media.characters && 'edges' in media.characters)
    ) {
      // is anilist media or already aggregated
      // doesn't need to be aggregated return as is
      return media as T;
    }

    media = media as DisaggregatedMedia;

    const mediaIds = (media.relations instanceof Array
      ? media.relations.slice(start, end)
      : [])
      .map((
        { mediaId },
      ) =>
        mediaId
      );

    const characterIds = (media.characters instanceof Array
      ? media.characters.slice(start, end)
      : [])
      .map((
        { characterId },
      ) => characterId);

    const [mediaRefs, characterRefs] = await Promise.all([
      findById<Media>({
        guildId,
        key: 'media',
        ids: mediaIds,
        defaultPackId: media.packId,
      }),
      findById<Character>({
        guildId,
        key: 'characters',
        ids: characterIds,
        defaultPackId: media.packId,
      }),
    ]);

    const t: Media = {
      ...media,
      relations: {
        edges: media.relations?.slice(start, end)
          ?.map(({ relation, mediaId }) => ({
            relation,
            node: mediaRefs[mediaId],
          })).filter(({ node }) => Boolean(node)) ?? [],
      },
      characters: {
        edges: media.characters?.slice(start, end)
          ?.map(({ role, characterId }) => ({
            role,
            node: characterRefs[characterId],
          })).filter(({ node }) => Boolean(node)) ?? [],
      },
    };

    return t as T;
  } else if (character) {
    if (character.media && 'edges' in character.media) {
      // is anilist media or already aggregated
      // doesn't need to be aggregated return as is
      return character as T;
    }

    character = character as DisaggregatedCharacter;

    const mediaIds = (character.media instanceof Array
      ? character.media.slice(start, end)
      : [])
      .map(({ mediaId }) =>
        mediaId
      );

    const [mediaRefs] = [
      await findById<Media>({
        guildId,
        key: 'media',
        ids: mediaIds,
        defaultPackId: character.packId,
      }),
    ];

    const t: Character = {
      ...character,
      media: {
        edges: character.media?.slice(start, end)
          ?.map(({ role, mediaId }) => ({
            role,
            node: mediaRefs[mediaId],
          })).filter(({ node }) => Boolean(node)) ?? [],
      },
    };

    return t as T;
  }

  throw new Error();
}

async function pool({ guildId, range, role, stars }: {
  guildId: string;
  range?: number[];
  role?: CharacterRole;
  stars?: number;
}): Promise<Pool['']['ALL']> {
  const [list, anilist] = await Promise.all([
    await packs.all({ guildId }),
    utils.readJson<Pool>('packs/anilist/pool.json'),
  ]);

  let pool: Pool[0]['ALL'] = [];

  if (typeof stars === 'number') {
    Object.values(anilist).forEach((range) => {
      pool = pool.concat(range.ALL);
    });
  } else {
    pool = anilist[JSON.stringify(range)][role ?? 'ALL'];
  }

  await Promise.all(list.map(async ({ manifest }) => {
    if (manifest.characters && Array.isArray(manifest.characters.new)) {
      const characters = await Promise.all(
        manifest.characters.new.map(async (char) => {
          char.packId = manifest.id;

          const character = await packs.aggregate<Character>({
            guildId,
            character: char,
          });

          const media = character.media?.edges?.[0]?.node;

          if (media) {
            const rating = Rating.fromCharacter(character).stars;

            return {
              id: `${manifest.id}:${character.id}`,
              mediaId: `${media.packId}:${media.id}`,
              rating,
            };
          }
        }),
      );

      pool = pool.concat(characters.filter(Boolean));
    }
  }));

  const occurrences: Record<string, boolean> = {};

  // shuffle here is to ensure that occurrences are randomly ordered
  utils.shuffle(pool);

  return pool.filter(({ mediaId, rating }) => {
    if (typeof stars === 'number' && rating !== stars) {
      return false;
    }

    if (occurrences[mediaId]) {
      return false;
    }

    return (occurrences[mediaId] = true);
  });
}

function aliasToArray(
  alias: Alias,
  max?: number,
): string[] {
  const set = new Set(
    [
      alias.english,
      alias.romaji,
      alias.native,
    ]
      .concat(alias.alternative ?? [])
      .filter(Boolean)
      .map((str) => max ? utils.truncate(str, max) : str),
  );

  return Array.from(set) as string[];
}

function formatToString(format?: MediaFormat): string {
  if (!format || format === MediaFormat.Music) {
    return '';
  }

  return utils.capitalize(
    format
      .replace(/TV_SHORT|OVA|ONA/, 'Short')
      .replace('VIDEO_GAME', 'Video Game')
      .replace('TV', 'Anime'),
  ) as string;
}

function mediaToString(
  { media, relation }: {
    media: Media | DisaggregatedMedia;
    relation?: MediaRelation;
  },
): string {
  const title = packs.aliasToArray(media.title, 40)[0];

  switch (relation) {
    case MediaRelation.Prequel:
    case MediaRelation.Sequel:
    case MediaRelation.SpinOff:
    case MediaRelation.SideStory:
      return [title, `(${utils.capitalize(relation)})`].join(' ');
    default: {
      const format = formatToString(media.format);

      if (!format) {
        return title;
      }

      return [title, `(${format})`].join(' ');
    }
  }
}

export default packs;
