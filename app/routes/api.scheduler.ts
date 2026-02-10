import { runScheduler } from "../utils/runScheduler";

export const loader = async () => {
  const schedules = await runScheduler();
  return ({ schedules });
};
