import cron from "node-cron";
import { runScheduler } from "./utils/runScheduler";

cron.schedule("* * * * *", async () => {
  try {
    await runScheduler();
    console.log("Scheduler executed");
  } catch (err) {
    console.error("Scheduler error:", err);
  }
});
