import { useRevalidator, useNavigate } from "react-router";
import { useState } from "react";
import "./schedule-config.css";
  
export default function ScheduleConfig() {
  const revalidator = useRevalidator();
  const navigate = useNavigate();

  const [enabled, setEnabled] = useState(true);
  const [frequency, setFrequency] = useState("daily");

  const [monthlyType, setMonthlyType] = useState<"date" | "weekday">("date");
  const [specificDate, setSpecificDate] = useState("1");

  const [dayPattern, setDayPattern] = useState("First");
  const [weekPattern, setWeekPattern] = useState("Sunday");

  const [repeatEvery, setRepeatEvery] = useState("1");
  const [runDay, setRunDay] = useState<string>("");

  const [scheduleTime, setScheduleTime] = useState("10:00");

  const [errors, setErrors] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);
  const [orderFilter, setOrderFilter] = useState<
    "all" | "fulfilled" | "unfulfilled"
  >("all");
  const [paymentStatus, setPaymentStatus] = useState<
    "all" | "paid" | "pending"
  >("all");
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [minItem, setMinItem] = useState<number | null>(null);

  const [orderTags, setOrderTags] = useState<string[]>([]);
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
    <div className="schedule-wrapper">
      {/* Schedule */}
      <div className="section">
        <h2>Schedule</h2>

        {/* Frequency Tabs */}
        <div className="form-row">
          <label htmlFor="daily">When</label>
          <div className="tabs">
            {["hourly","daily", "weekly", "monthly"].map((f) => (
              <button
                key={f}
                className={frequency === f ? "active" : ""}
                onClick={() => setFrequency(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Repeat every (ALL frequencies) */}
        <div className="form-row">
          <label htmlFor="repeatEvery">Repeat every</label>
          <input
            id="repeatEvery"
            type="number"
            value={repeatEvery}
            onChange={(e) => setRepeatEvery(e.target.value)}
          />
          {errors.repeatEvery && (
            <div className="error">{errors.repeatEvery}</div>
          )}
        </div>

        {/* Weekly */}
        {frequency === "weekly" && (
          <div className="form-row">
            <label htmlFor="runDay">Every</label>
            <select
              id="runDay"
              value={runDay}
              onChange={(e) => setRunDay(e.target.value)}
            >
              <option value="">Select Day</option>
              <option value="Sun">Sunday</option>
              <option value="Mon">Monday</option>
              <option value="Tue">Tuesday</option>
              <option value="Wed">Wednesday</option>
              <option value="Thu">Thursday</option>
              <option value="Fri">Friday</option>
              <option value="Sat">Saturday</option>
            </select>
            {errors.runDay && <div className="error">{errors.runDay}</div>}
          </div>
        )}

        {/* Monthly type */}
        {frequency === "monthly" && (
          <div className="form-row">
            <label htmlFor="monthlyType">Monthly type</label>
            <select
              id="monthlyType"
              value={monthlyType}
              onChange={(e) =>
                setMonthlyType(e.target.value as "date" | "weekday")
              }
            >
              <option value="date">On a specific date</option>
              <option value="weekday">On a weekday pattern</option>
            </select>
          </div>
        )}

        {/* Monthly – Specific date */}
        {frequency === "monthly" && monthlyType === "date" && (
          <div className="form-row">
            <label htmlFor="specificDate" >Select date</label>
            <select id="specificDate"
              value={specificDate}
              onChange={(e) => setSpecificDate(e.target.value)}
            >
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={String(i + 1)}>
                  {i + 1}
                </option>
              ))}
            </select>
            {errors.specificDate && (
              <div className="error">{errors.specificDate}</div>
            )}
          </div>
        )}

        {/* Monthly – Weekday pattern */}
        {frequency === "monthly" && monthlyType === "weekday" && (
          <>
            <div className="form-row">
              <label htmlFor="dayPattern">Day pattern</label>
              <select id="dayPattern"
                value={dayPattern}
                onChange={(e) => setDayPattern(e.target.value)}
              >
                <option value="First">First</option>
                <option value="Second">Second</option>
                <option value="Third">Third</option>
                <option value="Fourth">Fourth</option>
                <option value="Last">Last</option>
              </select>
              {errors.dayPattern && (
                <div className="error">{errors.dayPattern}</div>
              )}
            </div>

            <div className="form-row">
              <label htmlFor="weekPattern" >Weekday</label>
              <select id="weekPattern"
                value={weekPattern}
                onChange={(e) => setWeekPattern(e.target.value)}
              >
                <option value="Sunday">Sunday</option>
                <option value="Monday">Monday</option>
                <option value="Tuesday">Tuesday</option>
                <option value="Wednesday">Wednesday</option>
                <option value="Thursday">Thursday</option>
                <option value="Friday">Friday</option>
                <option value="Saturday">Saturday</option>
              </select>
              {errors.weekPattern && (
                <div className="error">{errors.weekPattern}</div>
              )}
            </div>
          </>
        )}

        {/* Time (ALL frequencies) */}
        <div className="form-row">
          <label htmlFor="time" >At</label>
          <input id="time"
            type="time"
            value={scheduleTime}
            onChange={(e) => setScheduleTime(e.target.value)}
          />
          {errors.scheduleTime && (
            <div className="error">{errors.scheduleTime}</div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="section">
        <h2>Order Filters</h2>

        <div className="filter-grid">
          <div className="choice-group">
            <label htmlFor="orderFilter" >Order status</label>
            <select id="orderFilter"
              value={orderFilter}
              onChange={(e) => setOrderFilter(e.target.value as any)}
            >
              <option value="all">All</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="unfulfilled">Unfulfilled</option>
            </select>
          </div>

          <div className="choice-group">
            <label htmlFor="paymentStatus">Payment status</label>
            <select id="paymentStatus"
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value as any)}
            >
              <option value="all">All</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div className="choice-group">
            <label htmlFor="setMinPrice" >Min order value</label>
            <select id="setMinPrice" onChange={(e) => setMinPrice(Number(e.target.value))}>
              <option value="">Any</option>
              <option value="10000">$10,000+</option>
              <option value="5000">$5,000+</option>
              <option value="3000">$3,000+</option>
              <option value="2000">$2,000+</option>
            </select>
          </div>

          <div className="choice-group">
            <label htmlFor="minItems" >Min items</label>
            <select id="minItems" onChange={(e) => setMinItem(Number(e.target.value))}>
              <option value="">Any</option>
              <option value="10">10+</option>
              <option value="7">7+</option>
              <option value="5">5+</option>
              <option value="3">3+</option>
              <option value="1">1+</option>
            </select>
          </div>

          <div className="choice-group">
            <label htmlFor="orderTags" >Order tags</label>
            <select id="orderTags"
              value={orderTags[0] || ""}
              onChange={(e) => setOrderTags([e.target.value])}
            >
              <option value="">Any</option>
              <option value="wear">Wear</option>
              <option value="fashion">Fashion</option>
              <option value="style">Style</option>
              <option value="regular">Regular</option>
            </select>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="save-bar">
        <button
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

                  runDays: frequency === "weekly" && runDay ? [runDay] : [],

                  monthlyType: frequency === "monthly" ? monthlyType : null,

                  specificDate:
                    frequency === "monthly" && monthlyType === "date"
                      ? specificDate
                      : null,

                  dayPattern:
                    frequency === "monthly" && monthlyType === "weekday"
                      ? dayPattern
                      : null,

                  weekPattern:
                    frequency === "monthly" && monthlyType === "weekday"
                      ? weekPattern
                      : null,

                  orderFilter,
                  paymentStatus,
                  minOrderValue: minPrice,
                  minItems: minItem,
                  orderTags,
                }),
              });
              revalidator.revalidate();
            } finally {
              setSaving(false);
            }
            navigate('/app/orders')
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

export async function ApplyFilter() {
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

                  runDays: frequency === "weekly" && runDay ? [runDay] : [],

                  monthlyType: frequency === "monthly" ? monthlyType : null,

                  specificDate:
                    frequency === "monthly" && monthlyType === "date"
                      ? specificDate
                      : null,

                  dayPattern:
                    frequency === "monthly" && monthlyType === "weekday"
                      ? dayPattern
                      : null,

                  weekPattern:
                    frequency === "monthly" && monthlyType === "weekday"
                      ? weekPattern
                      : null,

                  orderFilter,
                  paymentStatus,
                  minOrderValue: minPrice,
                  minItems: minItem,
                  orderTags,
                }),
              });
}