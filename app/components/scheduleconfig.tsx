import {
  Card,
  Text,
  Button,
  TextField,
  Select,
  Checkbox,
  ChoiceList,
} from "@shopify/polaris";
import {
  useRevalidator,
} from "react-router";
import { useState } from "react";


export default function ScheduleConfig() {
  const revalidator = useRevalidator();
  

  const [enabled, setEnabled] = useState(true);
  const [frequency, setFrequency] = useState("daily");

  const [monthlyType, setMonthlyType] = useState<"date" | "weekday">("date");
  const [specificDate, setSpecificDate] = useState("1");

  const [dayPattern, setDayPattern] = useState("First");
  const [weekPattern, setWeekPattern] = useState("Sunday");

  const [repeatEvery, setRepeatEvery] = useState("1");
  const [runDay, setRunDay] = useState<string>("Mon");

  const [scheduleTime, setScheduleTime] = useState("10:00");

  const [errors, setErrors] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);
  const [enableFilter, setEnableFilter] = useState(false);
  const [orderFilter, setOrderFilter] = useState<
    "all" | "fulfilled" | "unfulfilled"
  >("all");
  const [paymentStatus, setPaymentStatus] = useState<
    "all" | "paid" | "pending"
  >("all");
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [minItem, setMinItem] = useState<number | null>(null);

  const [orderTags, setOrderTags] = useState<string[]>([]);
  const [customerTags, setCustomerTags] = useState<string[]>([]);

  function renderScheduleSummary(schedule: any) {
    if (!schedule) return <Text as="p">No schedule configured</Text>;

    switch (schedule.frequency) {
      case "daily":
        return (
          <Text as="p">
            Runs daily at {schedule.scheduleTime || "--"} (24hr)
          </Text>
        );

      case "weekly": {
        const day = schedule.runDays ? JSON.parse(schedule.runDays)[0] : "--";
        return <Text as="p">Runs weekly on {day}</Text>;
      }

      case "monthly":
        if (schedule.monthlyType === "date") {
          return <Text as="p">Runs monthly on: {schedule.nextRunAt}</Text>;
        }

        if (schedule.monthlyType === "weekday") {
          return (
            <Text as="p">
              Runs monthly on {schedule.dayPattern} {schedule.weekPattern}
            </Text>
          );
        }

        return <Text as="p">Runs monthly</Text>;

      default:
        return <Text as="p">Schedule not configured</Text>;
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!scheduleTime) {
      newErrors.scheduleTime = "Run time is required";
    }

    if (!repeatEvery || Number(repeatEvery) <= 0) {
      newErrors.repeatEvery = "Repeat every must be greater than 0";
    }

    if (frequency === "monthly" && Number(repeatEvery) > 12) {
      newErrors.repeatEvery = "Monthly repeat cannot exceed 12";
    }

    if (frequency === "weekly" && !runDay) {
      newErrors.runDay = "Select a weekday";
    }

    if (frequency === "monthly") {
      if (monthlyType === "date" && !specificDate) {
        newErrors.specificDate = "Select a date";
      }

      if (monthlyType === "weekday") {
        if (!dayPattern) {
          newErrors.dayPattern = "Select day pattern";
        }
        if (!weekPattern) {
          newErrors.weekPattern = "Select week pattern";
        }
      }
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  return (
    <div style={{ width: 320 }}>
      <Card>
        <div style={{ padding: 16 }}>
          <Text variant="headingMd" as="h2">
            Schedule Report
          </Text>

          <div style={{ marginTop: 16 }}>
            <Checkbox
              label="Enable schedule"
              checked={enabled}
              onChange={setEnabled}
            />
          </div>

          <div style={{ marginTop: 16 }}>
            <Select
              label="Repeat"
              options={[
                { label: "Daily", value: "daily" },
                { label: "Weekly", value: "weekly" },
                { label: "Monthly", value: "monthly" },
              ]}
              value={frequency}
              onChange={(value) => setFrequency(value)}
            />
          </div>

          <div style={{ marginTop: 16 }}>
            <TextField
              label="Run time"
              type="time"
              value={scheduleTime || "--:--"}
              error={errors.scheduleTime}
              onChange={setScheduleTime}
              autoComplete="off"
            />
          </div>

          <div style={{ marginTop: 16 }}>
            <TextField
              label="Repeat every"
              type="number"
              value={repeatEvery}
              error={errors.repeatEvery}
              onChange={setRepeatEvery}
              autoComplete="off"
            />
          </div>

          {frequency === "weekly" && (
            <div style={{ marginTop: 16 }}>
              <ChoiceList
                title="Run on"
                choices={[
                  { label: "Sunday", value: "Sun" },
                  { label: "Monday", value: "Mon" },
                  { label: "Tuesday", value: "Tue" },
                  { label: "Wednesday", value: "Wed" },
                  { label: "Thursday", value: "Thu" },
                  { label: "Friday", value: "Fri" },
                  { label: "Saturday", value: "Sat" },
                ]}
                selected={[runDay]}
                onChange={(value) => setRunDay(value[0])}
              />
              {errors.runDay && (
                <Text as="p" tone="critical">
                  {errors.runDay}
                </Text>
              )}
            </div>
          )}

          {frequency === "monthly" && (
            <div style={{ marginTop: 16 }}>
              <ChoiceList
                title="Monthly Type"
                choices={[
                  { label: "On a specific date", value: "date" },
                  { label: "On a weekday pattern", value: "weekday" },
                ]}
                selected={[monthlyType]}
                onChange={(value) =>
                  setMonthlyType(value[0] as "date" | "weekday")
                }
              />

              {/* Specific Date */}
              {monthlyType === "date" && (
                <div style={{ marginTop: 12 }}>
                  <Select
                    label="Select Date"
                    options={Array.from({ length: 31 }, (_, i) => ({
                      label: `${i + 1}`,
                      value: String(i + 1),
                    }))}
                    value={specificDate}
                    error={errors.specificDate}
                    onChange={setSpecificDate}
                  />
                </div>
              )}

              {/* Weekday Pattern */}
              {monthlyType === "weekday" && (
                <div style={{ marginTop: 12 }}>
                  <Select
                    label="Day pattern"
                    options={[
                      { label: "First", value: "First" },
                      { label: "Second", value: "Second" },
                      { label: "Third", value: "Third" },
                      { label: "Fourth", value: "Fourth" },
                      { label: "Last", value: "Last" },
                    ]}
                    value={dayPattern}
                    error={errors.dayPattern}
                    onChange={setDayPattern}
                  />

                  <div style={{ marginTop: 12 }}>
                    <Select
                      label="Week pattern"
                      options={[
                        { label: "Sunday", value: "Sunday" },
                        { label: "Monday", value: "Monday" },
                        { label: "Tuesday", value: "Tuesday" },
                        { label: "Wednesday", value: "Wednesday" },
                        { label: "Thursday", value: "Thursday" },
                        { label: "Friday", value: "Friday" },
                        { label: "Saturday", value: "Saturday" },
                      ]}
                      value={weekPattern}
                      error={errors.weekPattern}
                      onChange={setWeekPattern}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div style={{ padding: 5 }}>
          <Text variant="headingMd" as="h2">
            Orders Filter
          </Text>

          <div style={{ marginTop: 16 }}>
            <Checkbox
              label="Enable Filter"
              checked={enableFilter}
              onChange={setEnableFilter}
            />
          </div>

          {enableFilter && (
            <div>
              <div style={{ marginTop: 16 }}>
                <ChoiceList
                  title="Order status"
                  choices={[
                    { label: "All orders", value: "all" },
                    { label: "Fulfilled only", value: "fulfilled" },
                    { label: "Unfulfilled only", value: "unfulfilled" },
                  ]}
                  selected={[orderFilter]}
                  onChange={(value) =>
                    setOrderFilter(
                      value[0] as "all" | "fulfilled" | "unfulfilled",
                    )
                  }
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <ChoiceList
                  title="Payment status"
                  choices={[
                    { label: "All Orders", value: "all" },
                    { label: "Paid Only", value: "paid" },
                    { label: "Pending Only", value: "pending" },
                  ]}
                  selected={[paymentStatus]}
                  onChange={(value) =>
                    setPaymentStatus(value[0] as "all" | "paid" | "pending")
                  }
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <ChoiceList
                  title="Min Order Value"
                  choices={[
                    { label: "$10,000+", value: "10000" },
                    { label: "$5,000+", value: "5000" },
                    { label: "$3,000+", value: "3000" },
                    { label: "$2,000+", value: "2000" },
                  ]}
                  selected={minPrice ? [String(minPrice)] : []}
                  onChange={(value) => setMinPrice(Number(value[0]))}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <ChoiceList
                  title="Min Items"
                  choices={[
                    { label: "10+", value: "10" },
                    { label: "7+", value: "7" },
                    { label: "5+", value: "5" },
                    { label: "3+", value: "3" },
                    { label: "1+", value: "1" },
                  ]}
                  selected={minItem ? [String(minItem)] : []}
                  onChange={(value) => setMinItem(Number(value[0]))}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <ChoiceList
                  title="Order Tags"
                  allowMultiple
                  choices={[
                    { label: "Wear", value: "wear" },
                    { label: "Fashion", value: "fashion" },
                    { label: "Style", value: "style" },
                    { label: "Regular", value: "regular" },
                  ]}
                  selected={orderTags}
                  onChange={setOrderTags}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <ChoiceList
                  title="Customer Tags"
                  allowMultiple
                  choices={[
                    { label: "VIP", value: "vip" },
                    { label: "Wholesale", value: "wholesale" },
                    { label: "Regular", value: "regular" },
                  ]}
                  selected={customerTags}
                  onChange={setCustomerTags}
                />
              </div>
            </div>
          )}
        </div>
      </Card>
      <div style={{ marginTop: 20, marginBottom: 20 }}>
        <Button
          fullWidth
          variant="primary"
          disabled={saving}
          onClick={async () => {
            if (!validateForm()) return;
            setSaving(true);
            try {
              await fetch("/api/schedule", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  enabled,
                  frequency,
                  scheduleTime,
                  repeatEvery,
                  runDays: runDay ? [runDay] : [],
                  monthlyType,
                  orderFilter,
                  paymentStatus,
                  minOrderValue: minPrice,
                  minItems: minItem,
                  orderTags,
                  customerTags,
                  specificDate,
                  dayPattern,
                  weekPattern,
                }),
              });
              revalidator.revalidate();
            } finally {
              setSaving(false);
            }
          }}
        >
          Save Schedule
        </Button>
      </div>
    </div>
  );
}
