/// <reference lib="deno.unstable" />

import '#filter-boolean';

import { ulid } from 'ulid';

import {
  charactersByInventoryPrefix,
  guildsByDiscordId,
  inventoriesByInstance,
  inventoriesByUser,
  usersByDiscordId,
} from './indices.ts';

import db, { kv } from './mod.ts';

import utils from '../src/utils.ts';

import { KvError } from '../src/errors.ts';

import type * as Schema from './schema.ts';

export const MAX_PULLS = 5;
export const MAX_NEW_PULLS = 10;
export const RECHARGE_MINS = 30;

export async function getUser(userId: string): Promise<Schema.User> {
  const response = await db.getValue<Schema.User>(usersByDiscordId(userId));

  if (response) {
    return response;
  }

  const newUser: Schema.User = {
    _id: ulid(),
    id: userId,
    inventories: [],
  };

  const insert = await kv.atomic()
    .check({ key: usersByDiscordId(userId), versionstamp: null })
    //
    .set(['users', newUser._id], newUser)
    .set(usersByDiscordId(userId), newUser)
    //
    .commit();

  if (insert.ok) {
    return newUser;
  }

  throw new KvError('failed to insert user');
}

export async function getGuild(guildId: string): Promise<Schema.Guild> {
  const response = await db.getValue<Schema.Guild>(guildsByDiscordId(guildId));

  if (response) {
    return response;
  }

  const newGuild: Schema.Guild = {
    _id: ulid(),
    id: guildId,
    instances: [],
  };

  const insert = await kv.atomic()
    .check({ key: guildsByDiscordId(guildId), versionstamp: null })
    //
    .set(['guilds', newGuild._id], newGuild)
    .set(guildsByDiscordId(guildId), newGuild)
    //
    .commit();

  if (insert.ok) {
    return newGuild;
  }

  throw new KvError('failed to insert guild');
}

export async function getInstance(
  guild: Schema.Guild,
): Promise<Schema.Instance> {
  if (guild.instances.length) {
    const response = await db.getValue<Schema.Instance>([
      'instances',
      guild.instances[0],
    ]);

    if (response) {
      return response;
    }
  }

  const newInstance: Schema.Instance = {
    _id: ulid(),
    main: true,
    guild: guild._id,
    inventories: [],
    packs: [],
  };

  guild.instances = [newInstance._id];

  const insert = await kv.atomic()
    //
    .set(['instances', newInstance._id], newInstance)
    //
    .set(['guilds', guild._id], guild)
    .set(guildsByDiscordId(guild.id), guild)
    //
    .commit();

  if (insert.ok) {
    return newInstance;
  }

  throw new KvError('failed to insert instance');
}

export async function getInstancePacks(
  instance: Schema.Instance,
): Promise<Schema.Pack[]> {
  const ids = instance.packs.map(({ pack }) => ['packs', pack]);

  const packs = (await db.getManyValues<Schema.Pack>(ids))
    .filter(Boolean);

  return packs;
}

export async function getInventory(
  instance: Schema.Instance,
  user: Schema.User,
): Promise<{
  inventory: Schema.Inventory;
  inventoryCheck: Deno.AtomicCheck;
}> {
  const key = inventoriesByUser(instance._id, user._id);

  const response = await db.getValueAndTimestamp<Schema.Inventory>(key);

  if (response?.value) {
    return {
      inventory: response.value,
      inventoryCheck: response,
    };
  }

  const newInventory: Schema.Inventory = {
    _id: ulid(),
    availablePulls: MAX_NEW_PULLS,
    instance: instance._id,
    user: user._id,
  };

  instance.inventories.push(newInventory._id);
  user.inventories.push(newInventory._id);

  const insert = await kv.atomic()
    .check({ key, versionstamp: null })
    //
    .set(['inventories', newInventory._id], newInventory)
    .set(inventoriesByUser(instance._id, user._id), newInventory)
    //
    .set(['instances', instance._id], instance)
    //
    .set(['users', user._id], user)
    .set(usersByDiscordId(user.id), user)
    //
    .commit();

  if (insert.ok) {
    return {
      inventory: newInventory,
      inventoryCheck: {
        key,
        versionstamp: (insert as Deno.KvCommitResult).versionstamp,
      },
    };
  }

  throw new KvError('failed to insert inventory');
}

export async function rechargePulls(
  instance: Schema.Instance,
  user: Schema.User,
  commit = true,
): Promise<{
  inventory: Schema.Inventory;
  inventoryCheck: Deno.AtomicCheck;
}> {
  let res = { ok: false }, retires = 0;

  while (!res.ok && retires < 5) {
    const { inventory, inventoryCheck } = await db.getInventory(
      instance,
      user,
    );

    const rechargeTimestamp = inventory.rechargeTimestamp
      ? new Date(inventory.rechargeTimestamp)
      : new Date();

    const currentPulls = inventory.availablePulls;

    const newPulls = Math.max(
      0,
      Math.min(
        MAX_PULLS - currentPulls,
        Math.trunc(
          utils.diffInMinutes(rechargeTimestamp, new Date()) / RECHARGE_MINS,
        ),
      ),
    );

    if (newPulls === currentPulls) {
      return { inventory, inventoryCheck };
    }

    const rechargedPulls = currentPulls + newPulls;

    inventory.availablePulls = Math.min(99, rechargedPulls);

    if (rechargedPulls >= MAX_PULLS) {
      inventory.rechargeTimestamp = undefined;
    } else {
      rechargeTimestamp.setMinutes(
        rechargeTimestamp.getMinutes() + (newPulls * RECHARGE_MINS),
      );

      inventory.rechargeTimestamp = rechargeTimestamp.toISOString();
    }

    if (!commit) {
      return { inventory, inventoryCheck };
    }

    res = await kv.atomic()
      .check(inventoryCheck)
      //
      .set(['inventories', inventory._id], inventory)
      .set(inventoriesByUser(inventory.instance, inventory._id), inventory)
      //
      .commit();

    if (res.ok) {
      return {
        inventory,
        inventoryCheck: {
          key: inventoryCheck.key,
          // TODO doesn't work
          // as workaround we avoid committing new changes
          // when we need to use the version stamp after recharging pulls
          // addCharacter() & addPulls()
          versionstamp: (res as Deno.KvCommitResult).versionstamp,
        },
      };
    }

    retires += 1;
  }

  throw new KvError('failed to update inventory');
}

export async function getInstanceInventories(
  instance: Schema.Instance,
): Promise<[Schema.Inventory, Schema.User][]> {
  const inventories = await db.getValues<Schema.Inventory>(
    { prefix: inventoriesByInstance(instance._id) },
  );

  const users = await db.getManyValues<Schema.User>(
    inventories.map(({ user }) => ['users', user]),
  );

  // deno-lint-ignore no-non-null-assertion
  return inventories.map((inventory, i) => [inventory, users[i]!]);
}

export async function getUserCharacters(
  inventory: Schema.Inventory,
): Promise<Deno.KvEntry<Schema.Character>[]> {
  const characters = await db.getValuesAndTimestamps<Schema.Character>(
    { prefix: charactersByInventoryPrefix(inventory._id) },
  );

  return characters;
}

export async function getUserParty(
  inventory: Schema.Inventory,
): Promise<Schema.Party> {
  const response = await db.getManyValues<Schema.Character>([
    ['characters', inventory.party?.member1 ?? ''],
    ['characters', inventory.party?.member2 ?? ''],
    ['characters', inventory.party?.member3 ?? ''],
    ['characters', inventory.party?.member4 ?? ''],
    ['characters', inventory.party?.member5 ?? ''],
  ]);

  return {
    member1: response[0],
    member2: response[1],
    member3: response[2],
    member4: response[3],
    member5: response[4],
  };
}
