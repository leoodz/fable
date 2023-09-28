import { join } from '$std/path/mod.ts';

import utils from '../../src/utils.ts';

import gacha from '../../src/gacha.ts';

import Rating from '../../src/rating.ts';

import { CharacterRole } from '../../src/types.ts';

import { gql, request } from './graphql.ts';

import { AniListCharacter, AniListMedia, Pool } from './types.ts';

const filepath = './pool.json';

const url = 'https://graphql.anilist.co';

const dirname = new URL('.', import.meta.url).pathname;

const ranges = Object.values(gacha.variables.ranges);

// (see https://github.com/ker0olos/fable/issues/9)
// (see https://github.com/ker0olos/fable/issues/45)

type Cache = Pool;

type PageInfo = {
  // total: number;
  // currentPage: number;
  // lastPage: number;
  hasNextPage: boolean;
  // perPage: number;
};

const cache: Cache = {};

async function queryMedia(
  variables: {
    page: number;
    popularity_greater: number;
    popularity_lesser?: number;
    role?: CharacterRole;
  },
): Promise<{
  pageInfo: PageInfo;
  media: AniListMedia[];
}> {
  const query = gql`
    query ($page: Int!, $popularity_greater: Int!, $popularity_lesser: Int) {
      Page(page: $page, perPage: 50) {
        pageInfo {
          hasNextPage
        }
        media(
          popularity_lesser: $popularity_lesser,
          popularity_greater: $popularity_greater,
          format_not_in: [ NOVEL, MUSIC, SPECIAL ],
          isAdult: false,
        ) {
          id
          characters(page: 1, perPage: 25) {
            pageInfo {
              hasNextPage
            }
            nodes {
              id # character id
              media(sort: POPULARITY_DESC) {
                edges {
                  characterRole # actual role
                  # actual media
                  node { 
                    id
                    popularity
                    isAdult
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const response: {
    pageInfo: PageInfo;
    media: AniListMedia[];
  } = (await request({
    url,
    query,
    variables,
  })).Page;

  return response;
}

async function queryCharacters(
  variables: {
    id: string;
    page: number;
  },
): Promise<{
  pageInfo: PageInfo;
  nodes: AniListCharacter[];
}> {
  const query = gql`
    query ($id: Int!, $page: Int!) {
      Media(id: $id) {
        characters(page: $page, perPage: 25) {
          pageInfo {
            hasNextPage
          }
          nodes {
            id # character id
            media(sort: POPULARITY_DESC) {
              edges {
                characterRole # actual role
                # actual media
                node { 
                  id
                  popularity
                  isAdult
                }
              }
            }
          }
        }
      }
    }
  `;

  const response: {
    Media: AniListMedia;
  } = await request({
    url,
    query,
    variables,
  });

  return {
    // deno-lint-ignore ban-ts-comment
    //@ts-ignore
    pageInfo: response.Media.characters?.pageInfo,
    // deno-lint-ignore no-non-null-assertion
    nodes: response.Media.characters?.nodes!,
  };
}

for (const range of ranges) {
  let mediaPage = 1;

  const key = JSON.stringify(range);

  const characters: Cache[''] = {
    ALL: [],
    MAIN: [],
    BACKGROUND: [],
    SUPPORTING: [],
  };

  console.log(`${key}: starting`);

  while (true) {
    try {
      const { pageInfo, media } = await queryMedia({
        page: mediaPage,
        popularity_greater: range[0],
        popularity_lesser: range[1] || undefined,
      });

      const t = {
        ALL: characters.ALL.length,
        MAIN: characters.MAIN.length,
        SUPPORTING: characters.SUPPORTING.length,
        BACKGROUND: characters.BACKGROUND.length,
      };

      for (const { id, characters: firstPage } of media) {
        let charactersPage = 1;

        while (true) {
          try {
            const { nodes, pageInfo } = charactersPage === 1
              // deno-lint-ignore no-non-null-assertion
              ? { nodes: firstPage!.nodes!, pageInfo: firstPage!.pageInfo }
              : await queryCharacters({
                id,
                page: charactersPage,
              });

            nodes.forEach((character) => {
              const media = character.media?.edges[0];

              const mediaId = `anilist:${media?.node.id}`;

              if (media && !media.node.isAdult) {
                const id = `anilist:${character.id}`;

                const rating = new Rating({
                  role: media.characterRole,
                  popularity: media?.node.popularity,
                }).stars;

                if (
                  media.node.popularity &&
                  media.node.popularity >= range[0] &&
                  (isNaN(range[1]) || media.node.popularity <= range[1])
                ) {
                  characters.ALL.push({ id, mediaId, rating });
                  characters[media.characterRole].push({ id, mediaId, rating });
                }
              }
            });

            if (pageInfo.hasNextPage) {
              charactersPage += 1;
              continue;
            }

            break;
          } catch (e) {
            // handle the rate limit
            // (see https://anilist.gitbook.io/anilist-apiv2-docs/overview/rate-limiting)
            if (e.message?.includes('Too Many Requests')) {
              console.log('sleeping for a minute...');
              await utils.sleep(60);
              continue;
            }

            throw e;
          }
        }
      }

      console.log(
        `${key}: page: ${mediaPage} had: total ${
          characters.ALL.length - t.ALL
        } characters: MAIN: ${characters.MAIN.length - t.MAIN} | SUPPORTING: ${
          characters.SUPPORTING.length - t.SUPPORTING
        } | BACKGROUND: ${characters.BACKGROUND.length - t.BACKGROUND}`,
      );

      if (pageInfo.hasNextPage) {
        mediaPage += 1;
        continue;
      }

      break;
    } catch (e) {
      // handle the rate limit
      // (see https://anilist.gitbook.io/anilist-apiv2-docs/overview/rate-limiting)
      if (e.message?.includes('Too Many Requests')) {
        console.log('sleeping for a minute...');
        await utils.sleep(60);
        continue;
      }

      throw e;
    }
  }

  console.log(`${key}: finished`);

  if (characters.ALL.length > 0) {
    cache[JSON.stringify(range)] = characters;
  }
}

await Deno.writeTextFile(
  join(dirname, filepath),
  JSON.stringify(cache),
);

let totalCharacters = 0;

Object.values(cache).forEach(({ ALL }) => totalCharacters += ALL.length);

console.log(`${totalCharacters} characters`);

console.log('\n\nwritten cache to disk');
