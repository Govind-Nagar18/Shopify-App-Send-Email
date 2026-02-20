import prisma from "../db.server";
import { sessionStorage, shopifyback } from "../shopify.server";
import { generateOrdersExcel } from "./generateOrderExcel.server";
import { sendOrdersEmail } from "./sendOrdersEmail.server";
import type { EmailSchedule } from "@prisma/client";

interface LineItem {
  id: number;
  name: string;
  quantity: number;
  price: string;
}

type ShopifyOrder = {
  id: number;
  name: string;
  created_at: string;
  current_total_price: string;
  financial_status: string;
  fulfillment_status: string | null;
  tags?: string;
  customer?: {
    first_name?: string;
    last_name?: string;
  };
  line_items: LineItem[];
};

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

    if (schedule.paymentStatus === "paid") {
      query.financial_status = "paid";
    }

    if (schedule.paymentStatus === "pending") {
      query.financial_status = "pending";
    }

    return query;
  }

  function getLastDayOfMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
  }

  function getMonthlyWeekdayDate(
    year: number,
    month: number,
    dayPattern: string,
    weekPattern: string,
  ): number | null {
    const weekdayMap: Record<string, number> = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };

    const targetWeekday = weekdayMap[weekPattern];
    if (targetWeekday === undefined) return null;

    const daysInMonth = getLastDayOfMonth(year, month);
    const matches: number[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      if (date.getDay() === targetWeekday) {
        matches.push(day);
      }
    }

    switch (dayPattern) {
      case "First":
        return matches[0] ?? null;
      case "Second":
        return matches[1] ?? null;
      case "Third":
        return matches[2] ?? null;
      case "Fourth":
        return matches[3] ?? null;
      case "Last":
        return matches[matches.length - 1] ?? null;
      default:
        return null;
    }
  }

  function getScheduleDateRange(schedule: EmailSchedule, now: Date) {
    const start = new Date(now);

    switch (schedule.frequency) {
      case "daily":
        start.setDate(start.getDate() - schedule.repeatEvery);
        break;

      case "weekly":
        start.setDate(start.getDate() - schedule.repeatEvery * 7);
        break;

      case "monthly":
        start.setMonth(start.getMonth() - schedule.repeatEvery);
        break;

      default:
        start.setDate(start.getDate() - 7);
    }

    return {
      created_at_min: start.toISOString(),
      created_at_max: now.toISOString(),
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
      let runDays: string[];

      try {
        runDays = JSON.parse(schedule.runDays);
      } catch {
        return null;
      }

      const dayMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const next = new Date(base);

      for (let i = 0; i < 90; i++) {
        const diffWeeks = Math.floor(
          (next.getTime() - base.getTime()) / (7 * 86400000),
        );
        if (
          runDays.includes(dayMap[next.getDay()]) &&
          diffWeeks % Number(repeatEvery) === 0
        ) {
          applyTime(next, scheduleTime);
          if (next > now) return next;
        }
        next.setDate(next.getDate() + 1);
      }
    }

    if (frequency === "monthly") {
      const next = new Date(base);

      for (let i = 0; i < 24; i++) {
        const year = next.getFullYear();
        const month = next.getMonth();

        let executionDate: number | null = null;

        if (schedule.monthlyType === "date" && schedule.specificDate) {
          executionDate = schedule.specificDate;
        }

        if (
          schedule.monthlyType === "weekday" &&
          schedule.dayPattern &&
          schedule.weekPattern
        ) {
          executionDate = getMonthlyWeekdayDate(
            year,
            month,
            schedule.dayPattern,
            schedule.weekPattern,
          );
        }

        if (executionDate) {
          const candidate = new Date(year, month, executionDate);
          applyTime(candidate, scheduleTime);

          if (candidate > now) return candidate;
        }

        next.setMonth(next.getMonth() + Number(repeatEvery));
      }
    }

    return null;
  }

  for (const schedule of schedules) {
    const nextRun = calculateNextRun(schedule);

    const session = await sessionStorage.loadSession(
      `offline_${schedule.shop}`,
    );
    if (!session) continue;

    const client = new shopifyback.clients.Rest({ session });

    const dateRange = getScheduleDateRange(schedule, now);

    const ordersResponse = await client.get({
      path: "orders",
      query: buildOrderQuery(schedule, dateRange),
    });

    let orders = ordersResponse.body.orders as ShopifyOrder[];

    // Min Order Value
    const minOrderValue = schedule.minOrderValue;
    if (minOrderValue !== null) {
      orders = orders.filter(
        (order) => Number(order.current_total_price) >= minOrderValue,
      );
    }

    // Min Items
    const minItems = schedule.minItems;
    if (minItems !== null) {
      orders = orders.filter((order) => order.line_items.length >= minItems);
    }

    // Order Tag
    if (schedule.orderTags) {
      const tag = schedule.orderTags.toLowerCase();
      orders = orders.filter((order) =>
        order.tags
          ?.toLowerCase()
          .split(",")
          .map((t) => t.trim())
          .includes(tag),
      );
    }

    const excelBuffer =
      orders.length > 0 ? await generateOrdersExcel(orders) : null;

    await sendOrdersEmail(schedule.email, schedule.shop, excelBuffer);

    await prisma.emailSchedule.update({
      where: { id: schedule.id },
      data: {
        lastRunAt: now,
        nextRunAt: nextRun,
      },
    });

    console.log(`Email sent for schedule ${schedule.id}`);
  }

  return schedules;
}
