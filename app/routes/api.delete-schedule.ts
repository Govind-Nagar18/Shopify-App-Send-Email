import type { ActionFunctionArgs } from "react-router";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const body = await request.json();
  const { scheduleId } = body;

  if (!scheduleId) {
    return new Response("Schedule ID is required", { status: 400 });
  }

  const schedule = await prisma.emailSchedule.findFirst({
    where: {
      id: scheduleId,
      shop,
    },
  });

  if (!schedule) {
    return new Response("Schedule not found", { status: 404 });
  }

  await prisma.emailSchedule.delete({
    where: {
      id: scheduleId,
    },
  });

  return Response.json({ success: true });
};