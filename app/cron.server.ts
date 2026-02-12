import cron from "node-cron";
import { runScheduler } from "./utils/runScheduler";

const globalForScheduler = globalThis as unknown as {
  __schedulerStarted?: boolean;
};

if (!globalForScheduler.__schedulerStarted) {
  globalForScheduler.__schedulerStarted = true;

  cron.schedule("* * * * *", async () => {
    try {
      await runScheduler();
      console.log("Scheduler executed");
    } catch (err) {
      console.error("Scheduler error:", err);
    }
  });

  console.log("Scheduler initialized");
}
