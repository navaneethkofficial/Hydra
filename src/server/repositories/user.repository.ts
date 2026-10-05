import "server-only";
import type { Prisma, User } from "@prisma/client";

import { prisma } from "@/server/db";

/**
 * User persistence.
 *
 * Repositories are the only modules that touch Prisma. Services orchestrate,
 * repositories store — which is what keeps the domain logic testable without a
 * database and the storage swappable without touching business rules.
 */

export type UserWithSettings = Prisma.UserGetPayload<{
  include: { profile: true; reminderSettings: true };
}>;

export function findByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
}

export function findById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

export function findWithSettings(id: string): Promise<UserWithSettings | null> {
  return prisma.user.findUnique({
    where: { id },
    include: { profile: true, reminderSettings: true },
  });
}

/**
 * Creates the user together with default hydration and reminder settings, in
 * one transaction. A half-created account with no profile is not a state the
 * rest of the app should ever have to handle.
 */
export function createUser(data: {
  name: string;
  email: string;
  passwordHash?: string | null;
  image?: string | null;
  timezone: string;
}): Promise<UserWithSettings> {
  return prisma.user.create({
    data: {
      ...data,
      email: data.email.toLowerCase(),
      profile: { create: {} },
      reminderSettings: { create: {} },
    },
    include: { profile: true, reminderSettings: true },
  });
}

export function updateUser(id: string, data: Prisma.UserUpdateInput): Promise<User> {
  return prisma.user.update({ where: { id }, data });
}

export function deleteUser(id: string): Promise<User> {
  // Every related row cascades — see `onDelete: Cascade` in the schema.
  return prisma.user.delete({ where: { id } });
}

export function findOAuthAccount(provider: string, providerAccountId: string) {
  return prisma.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId } },
    include: { user: true },
  });
}

export function linkOAuthAccount(userId: string, provider: string, providerAccountId: string) {
  return prisma.oAuthAccount.create({ data: { userId, provider, providerAccountId } });
}

export function hasOAuthAccount(userId: string, provider: string): Promise<boolean> {
  return prisma.oAuthAccount
    .count({ where: { userId, provider } })
    .then((count) => count > 0);
}
