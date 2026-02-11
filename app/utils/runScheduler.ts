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
    const startDate = schedule.lastRunAt
      ? new Date(schedule.lastRunAt)
      : new Date(schedule.createdAt);

    return {
      created_at_min: startDate.toISOString(),
      created_at_max: new Date().toISOString(),
    };
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
    if (!schedule.nextRunAt) continue;

    try {
      const session = await sessionStorage.loadSession(
        `offline_${schedule.shop}`,
      );

      if (!session) continue;

      const client = new shopifyback.clients.Rest({ session });

      const { created_at_min, created_at_max } =
        getDateRange(schedule);

      const ordersResponse = await client.get({
        path: "orders",
        query: {
          status: "any",
          created_at_min,
          created_at_max,
        },
      });

      const orders = ordersResponse.body.orders;

      let excelBuffer: Buffer | null = null;

      if (orders.length) {
        excelBuffer = await generateOrdersExcel(orders);
      }

      await sendOrdersEmail(schedule.email, schedule.shop, excelBuffer);

      const nextRun = calculateNextRun(schedule);

      await prisma.emailSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: new Date(),
          nextRunAt: nextRun,
        },
      });

      console.log("Schedule completed:", schedule.shop);

    } catch (error) {
      console.error("Scheduler failed:", schedule.shop, error);
    }
  }

  return schedules;
}
