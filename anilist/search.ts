import {
  json,
} from 'https://raw.githubusercontent.com/ker0olos/bots/main/index.ts';

import * as anilist from './api.ts';
import {
  colors,
  componentsIds,
  componentTypes,
  NEW_MESSAGE,
  UPDATE_MESSAGE,
} from './meta.ts';

// deno-lint-ignore no-explicit-any
export async function nextSearchPage({ embeds }: { embeds: any[] }) {
  return json({
    type: UPDATE_MESSAGE,
    data: {
      components: [],
      embeds: [
        {
          type: 'rich',
          title: 'Unimplemented',
          description: JSON.stringify(embeds[0].footer),
        },
      ],
    },
  });
}

export async function searchPage(
  { search, page, next, prev }: {
    search: string;
    page: number;
    next: boolean;
    prev: boolean;
  },
) {
  try {
    const results = await anilist.search({ search, page });

    if (!results.media.length) {
      throw new Error('404');
    }

    return json({
      type: NEW_MESSAGE,
      data: {
        content: `${results.media[0].title.english}`,
        embeds: [
          {
            type: 'rich',
            title: results.media[0].title.english,
            description: results.media[0].description,
            color: results.media[0].coverImage?.color,
            // fields: [
            //   {
            //     name: '',
            //     value: '',
            //   },
            // ],
            image: {
              url: results.media[0].coverImage?.large,
              // height: 0,
              // width: 0,
            },
            footer: {
              text: [
                results.media[0].title.romaji,
                results.media[0].title.native,
              ].filter(Boolean).join(' - '),
              // icon_url: '-',
              // proxy_icon_url: '-',
            },
          },
        ],
        components: [
          {
            type: componentTypes.GROUP,
            components: [
              prev
                ? {
                  style: colors.grey,
                  type: componentTypes.BUTTON,
                  custom_id: componentsIds.prevPage,
                  label: 'Prev',
                }
                : null,
              next
                ? {
                  style: colors.grey,
                  type: componentTypes.BUTTON,
                  custom_id: componentsIds.nextPage,
                  label: 'Next',
                }
                : null,
            ],
          },
        ],
      },
    });
  } catch (err) {
    if (err?.response?.status === 404 || err?.message === '404') {
      return json({
        type: NEW_MESSAGE,
        data: {
          content: 'Found nothing matching that name!',
        },
      });
    }

    return json({ errors: err.errors }, { status: err.response.status });
  }
}