import { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { scheduleId } = await request.json();

  if (!scheduleId) {
    return new Response("Schedule ID is required", { status: 400 });
  }

  const schedule = await prisma.emailSchedule.findFirst({
    where: {
      id: scheduleId,
      shop: session.shop,
    },
  });

  if (!schedule) {
    return new Response("Schedule not found", { status: 404 });
  }

  const isEnabling = !schedule.isEnabled;

  await prisma.emailSchedule.update({
    where: { id: scheduleId },
    data: {
      isEnabled: isEnabling,
      nextRunAt: isEnabling ? new Date() : null,
    },
  });

  return { success: true };
};
