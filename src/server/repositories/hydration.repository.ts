import "server-only";
import type { DailySummary, LogSource, WaterLog } from "@prisma/client";

import { prisma } from "@/server/db";

/**
 * Water logs and their per-day rollups.
 *
 * Reads are always scoped by `userId` — hydration data is private, and the
 * scope lives here rather than in each service so it cannot be forgotten.
 */

export function listLogsForDay(userId: string, dayKey: string): Promise<WaterLog[]> {
  return prisma.waterLog.findMany({
    where: { userId, dayKey },
    orderBy: { loggedAt: "asc" },
  });
}

export function listLogsBetween(userId: string, from: Date, to: Date): Promise<WaterLog[]> {
  return prisma.waterLog.findMany({
    where: { userId, loggedAt: { gte: from, lte: to } },
    orderBy: { loggedAt: "asc" },
  });
}

export function findLog(userId: string, id: string): Promise<WaterLog | null> {
  return prisma.waterLog.findFirst({ where: { id, userId } });
}

export function findLogByClientId(userId: string, clientId: string): Promise<WaterLog | null> {
  return prisma.waterLog.findFirst({ where: { userId, clientId } });
}

export function createLog(data: {
  userId: string;
  amount: number;
  loggedAt: Date;
  dayKey: string;
  source: LogSource;
  clientId?: string | null;
}): Promise<WaterLog> {
  return prisma.waterLog.create({ data });
}

export function deleteLog(userId: string, id: string): Promise<number> {
  return prisma.waterLog.deleteMany({ where: { id, userId } }).then((result) => result.count);
}

// --- Daily rollups ----------------------------------------------------------

export function findSummary(userId: string, dayKey: string): Promise<DailySummary | null> {
  return prisma.dailySummary.findUnique({ where: { userId_date: { userId, date: dayKey } } });
}

export function listSummaries(userId: string, from: string, to: string): Promise<DailySummary[]> {
  return prisma.dailySummary.findMany({
    where: { userId, date: { gte: from, lte: to } },
    orderBy: { date: "asc" },
  });
}

/**
 * Recomputes a day's rollup from its logs.
 *
 * Derived rather than incremented on purpose: a deleted log, an edited goal or
 * a replayed offline batch all converge to the same correct answer, so the
 * rollup can never drift out of step with the logs it summarises.
 */
export async function rebuildSummary(
  userId: string,
  dayKey: string,
  goal: number,
): Promise<DailySummary> {
  const aggregate = await prisma.waterLog.aggregate({
    where: { userId, dayKey },
    _sum: { amount: true },
    _count: { _all: true },
    _min: { loggedAt: true },
    _max: { loggedAt: true },
  });

  const totalAmount = aggregate._sum.amount ?? 0;
  const safeGoal = goal > 0 ? goal : 1;
  const percentage = Math.min(100, Math.round((totalAmount / safeGoal) * 100));

  const data = {
    totalAmount,
    goal,
    percentage,
    goalCompleted: totalAmount >= goal,
    logCount: aggregate._count._all,
    firstLogAt: aggregate._min.loggedAt,
    lastLogAt: aggregate._max.loggedAt,
  };

  return prisma.dailySummary.upsert({
    where: { userId_date: { userId, date: dayKey } },
    create: { userId, date: dayKey, ...data },
    update: data,
  });
}

/** Rewrites the stored goal on days that have no logs yet, after a goal change. */
export function updateFutureGoals(userId: string, fromDayKey: string, goal: number) {
  return prisma.dailySummary.updateMany({
    where: { userId, date: { gte: fromDayKey }, logCount: 0 },
    data: { goal, goalCompleted: false, percentage: 0 },
  });
}
