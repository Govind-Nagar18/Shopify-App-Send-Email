import { ActionFunctionArgs } from "react-router";
import { authenticate, shopifyback } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const requestBody = await request.json();

  const {
    enabled,
    frequency,
    scheduleTime,
    repeatEvery,
    runDays,
    monthlyType,
    specificDate,
    dayPattern,
    weekPattern,
    orderFilter,
    paymentStatus,
    minOrderValue,
    minItems,
    orderTags,
  } = requestBody;

  const now = new Date();

  const client = new shopifyback.clients.Rest({ session });

  const shopResponse = await client.get({
    path: "shop",
  });

  type ShopResponse = {
    shop: { email: string };
  };

  const shopBody = shopResponse.body as unknown as ShopResponse;
  const shopEmail = shopBody.shop.email;

  function applyTime(date: Date, time: string) {
    if (!time || !time.includes(":")) return date;

    const [hour, minute] = time.split(":").map(Number);
    date.setHours(hour || 0, minute || 0, 0, 0);
    return date;
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
        return matches[0];
      case "Second":
        return matches[1];
      case "Third":
        return matches[2];
      case "Fourth":
        return matches[3];
      case "Last":
        return matches[matches.length - 1];
      default:
        return null;
    }
  }

  function calculateNextRun(): Date | null {
    const base = new Date(now);

    if (frequency === "hourly") {
      const next = new Date(base);
      applyTime(next, scheduleTime);

      while (next <= now) {
        next.setHours(next.getHours() + Number(repeatEvery));
      }
      return next;
    }

    if (frequency === "daily") {
      const next = new Date(base);
      applyTime(next, scheduleTime);

      while (next <= now) {
        next.setDate(next.getDate() + Number(repeatEvery));
      }
      return next;
    }

    if (frequency === "weekly" && Array.isArray(runDays) && runDays.length) {
      const dayMap: Record<string, number> = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
      };

      const repeatWeeks = Number(repeatEvery);

      const anchor = new Date(base);
      anchor.setHours(0, 0, 0, 0);
      anchor.setDate(anchor.getDate() - anchor.getDay());

      for (let interval = 1; interval <= 52; interval++) {
        const intervalStart = new Date(anchor);
        intervalStart.setDate(anchor.getDate() + interval * repeatWeeks * 7);

        for (const day of runDays) {
          const target = new Date(intervalStart);
          target.setDate(
            intervalStart.getDate() +
              ((dayMap[day] - intervalStart.getDay() + 7) % 7),
          );

          applyTime(target, scheduleTime);

          if (target > now) {
            return target;
          }
        }
      }
    }

    if (frequency === "monthly") {
      const repeatMonths = Number(repeatEvery);
      const cursor = new Date(base);

      cursor.setDate(1);

      for (let i = 0; i < 36; i += repeatMonths) {
        const year = cursor.getFullYear();
        const month = cursor.getMonth();

        let executionDate: number | null = null;

        if (monthlyType === "date" && specificDate) {
          const lastDay = getLastDayOfMonth(year, month);
          executionDate = Math.min(specificDate, lastDay);
        }

        if (monthlyType === "weekday" && dayPattern && weekPattern) {
          executionDate = getMonthlyWeekdayDate(
            year,
            month,
            dayPattern,
            weekPattern,
          );
        }

        if (executionDate) {
          const candidate = new Date(year, month, executionDate);
          applyTime(candidate, scheduleTime);

          if (candidate > now) {
            return candidate;
          }
        }

        cursor.setMonth(cursor.getMonth() + repeatMonths);
      }
    }

    return null;
  }

  const normalizedRunDays =
    frequency === "weekly" && Array.isArray(runDays)
      ? JSON.stringify(runDays)
      : null;

  const nextRun = calculateNextRun();

  if (enabled && !nextRun) {
    throw new Error("Unable to calculate next run date");
  }

  const url = new URL(request.url);
  const scheduleId = url.searchParams.get("scheduleId");

  if (scheduleId) {
    await prisma.emailSchedule.update({
      where: {
        id: scheduleId,
        shop,
      },
      data: {
        email: shopEmail,
        isEnabled: enabled,
        frequency,
        orderFilter,
        paymentStatus,
        minOrderValue,
        minItems,
        orderTags: orderTags?.length ? orderTags.join(",") : null,
        repeatEvery: Number(repeatEvery),
        runDays: normalizedRunDays,
        monthlyType: frequency === "monthly" ? monthlyType : null,
        specificDate:
          frequency === "monthly" && monthlyType === "date"
            ? Number(specificDate)
            : null,
        dayPattern:
          frequency === "monthly" && monthlyType === "weekday"
            ? dayPattern
            : null,
        weekPattern:
          frequency === "monthly" && monthlyType === "weekday"
            ? weekPattern
            : null,
        scheduleTime,
        nextRunAt: enabled ? nextRun : null,
      },
    });
  } else {
    await prisma.emailSchedule.create({
      data: {
        shop,
        email: shopEmail,
        isEnabled: enabled,
        frequency,
        orderFilter,
        paymentStatus,
        minOrderValue,
        minItems,
        orderTags: orderTags?.length ? orderTags.join(",") : null,
        repeatEvery: Number(repeatEvery),
        runDays: normalizedRunDays,
        monthlyType,
        specificDate: specificDate ? Number(specificDate) : null,
        dayPattern,
        weekPattern,
        scheduleTime,
        nextRunAt: nextRun,
        name: `Orders – ${frequency} – ${new Date().toLocaleString()}`,
      },
    });
  }

  return { success: true };
};
