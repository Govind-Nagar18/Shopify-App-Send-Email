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

    // DAILY
    if (frequency === "daily") {
      const next = new Date(base);
      applyTime(next, scheduleTime);

      if (next <= now) {
        next.setDate(next.getDate() + Number(repeatEvery));
      }
      return next;
    }

    // WEEKLY
    if (frequency === "weekly" && runDays?.length) {
      const parsedDays: string[] = runDays;
      const dayMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

      const next = new Date(base);

      for (let i = 0; i < 90; i++) {
        // look ahead 90 days
        const diffTime = next.getTime() - now.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const weeksPassed = Math.floor(diffDays / 7);

        const todayName = dayMap[next.getDay()];

        if (
          parsedDays.includes(todayName) &&
          weeksPassed % Number(repeatEvery) === 0
        ) {
          applyTime(next, scheduleTime);

          if (next > now) {
            return next;
          }
        }

        next.setDate(next.getDate() + 1);
      }
    }

    // MONTHLY
    if (frequency === "monthly") {
      const next = new Date(base);

      for (let i = 0; i < 24; i++) {
        // look ahead 24 months
        const year = next.getFullYear();
        const month = next.getMonth();

        let executionDate: number | null = null;

        if (monthlyType === "date" && specificDate) {
          const lastDay = getLastDayOfMonth(year, month);
          executionDate = specificDate > lastDay ? lastDay : specificDate;
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

        next.setMonth(next.getMonth() + Number(repeatEvery));
      }
    }
    return null;
  }

  const nextRun = calculateNextRun();

  await prisma.emailSchedule.upsert({
    where: { shop },
    update: {
      email: shopEmail,
      isEnabled: enabled,
      frequency,
      orderFilter,
      paymentStatus,
      repeatEvery: Number(repeatEvery),
      runDays: runDays?.length ? JSON.stringify(runDays) : null,
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
    create: {
      shop,
      email: shopEmail,
      isEnabled: enabled,
      frequency,
      orderFilter,
      paymentStatus,
      repeatEvery: Number(repeatEvery),
      runDays: runDays?.length ? JSON.stringify(runDays) : null,
      monthlyType,
      specificDate: specificDate ? Number(specificDate) : null,
      dayPattern,
      weekPattern,
      scheduleTime,
      nextRunAt: nextRun,
    },
  });

  return { success: true };
};
