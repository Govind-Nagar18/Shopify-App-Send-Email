import { ActionFunctionArgs } from "react-router";
import { authenticate, shopifyback } from "../shopify.server";
import  prisma  from "../db.server";



export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const client = new shopifyback.clients.Rest({ session });

  const shopResponse = await client.get({
    path: "shop",
  });

  const shopEmail = shopResponse.body.shop.email;

  const form = await request.formData();
  const scheduleTime = form.get("scheduleTime") as string;

  await prisma.emailSchedule.upsert({
    where: { shop: session.shop },
    update: { scheduleTime, email: shopEmail },
    create: {
      shop: session.shop,
      email: shopEmail,
      scheduleTime,
    },
  });

  return { success: true };
};


