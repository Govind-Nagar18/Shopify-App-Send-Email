import prisma from "../db.server";
import { sessionStorage, shopifyback } from "../shopify.server";
import { generateOrdersExcel } from "./generateOrderExcel.server";
import { sendOrdersEmail } from "./sendOrdersEmail.server";
import type { EmailSchedule } from "@prisma/client";

export async function runScheduler() {
  const now = new Date();

  const schedules = await prisma.emailSchedule.findMany({
    where: {
      isEnabled: true,
      nextRunAt: {
        lte: now,
      },
    },
  });

  function getDateRange(schedule: EmailSchedule) {
    const now = new Date();
    let startDate: Date;

    if (schedule.frequency === "daily") {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
    } else if (schedule.frequency === "weekly") {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
    } else if (schedule.frequency === "monthly") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      startDate = new Date(now);
    }

    return {
      created_at_min: startDate.toISOString(),
      created_at_max: now.toISOString(),
    };
  }

  function buildOrderQuery(
    schedule: EmailSchedule,
    dateRange: { created_at_min: string; created_at_max: string },
  ) {
    const query: Record<string, string> = {
      status: "any",
      created_at_min: dateRange.created_at_min,
      created_at_max: dateRange.created_at_max,
    };

    if (schedule.orderFilter === "fulfilled") {
      query.fulfillment_status = "fulfilled";
    }

    if (schedule.orderFilter === "unfulfilled") {
      query.fulfillment_status = "unfulfilled";
    }

    return query;
  }

  function calculateNextRun(schedule: EmailSchedule): Date | null {
    const now = new Date();

    const base = schedule.nextRunAt
      ? new Date(schedule.nextRunAt)
      : new Date(schedule.createdAt);

    const { frequency, repeatEvery, scheduleTime } = schedule;

    function applyTime(date: Date, time: string) {
      if (!time || !time.includes(":")) return date;
      const [hour, minute] = time.split(":").map(Number);
      date.setHours(hour || 0, minute || 0, 0, 0);
      return date;
    }

    if (frequency === "daily") {
      const next = new Date(base);
      next.setDate(next.getDate() + Number(repeatEvery));
      applyTime(next, scheduleTime);
      return next;
    }

    if (frequency === "weekly" && schedule.runDays) {
      let selectedDay: string | null = null;

      try {
        const parsed = JSON.parse(schedule.runDays);
        selectedDay = Array.isArray(parsed) ? parsed[0] : parsed;
      } catch {
        selectedDay = null;
      }

      if (!selectedDay) return null;

      const dayMap: Record<string, number> = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
      };

      const targetDay = dayMap[selectedDay];
      const next = new Date(base);

      while (next.getDay() !== targetDay) {
        next.setDate(next.getDate() + 1);
      }

      applyTime(next, scheduleTime);

      if (next <= now) {
        next.setDate(next.getDate() + 7 * Number(repeatEvery));
      }

      return next;
    }

    if (frequency === "monthly") {
      const next = new Date(base);
      next.setMonth(next.getMonth() + Number(repeatEvery));
      applyTime(next, scheduleTime);
      return next;
    }

    return null;
  }

  for (const schedule of schedules) {
    const nextRun = calculateNextRun(schedule);

    const locked = await prisma.emailSchedule.updateMany({
      where: {
        id: schedule.id,
        nextRunAt: { lte: now },
      },
      data: {
        lastRunAt: now,
        nextRunAt: nextRun,
      },
    });

    if (locked.count === 0) continue;

    const session = await sessionStorage.loadSession(
      `offline_${schedule.shop}`,
    );
    if (!session) continue;

    const client = new shopifyback.clients.Rest({ session });
    const dateRange = getDateRange(schedule);

    const ordersResponse = await client.get({
      path: "orders",
      query: buildOrderQuery(schedule, dateRange),
    });

    const orders = ordersResponse.body.orders;

    const excelBuffer =
      orders.length > 0 ? await generateOrdersExcel(orders) : null;

    await sendOrdersEmail(schedule.email, schedule.shop, excelBuffer);
  }

  return schedules;
}
