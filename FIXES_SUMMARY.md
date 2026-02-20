# Multiple Schedules Per Shop - Bug Fixes

## Problems Found & Fixed

### 1. **api.download-report.ts** ❌→✅
**Issue:** Using `findMany()` but treating result as single object
```typescript
// BEFORE (Wrong)
const schedule = await prisma.emailSchedule.findMany({...});
if (!schedule) { ... }  // This doesn't work - array is always truthy

// AFTER (Correct)
const scheduleId = url.searchParams.get("scheduleId");
const schedule = await prisma.emailSchedule.findUnique({
  where: { id: scheduleId }
});
if (!schedule || schedule.shop !== session.shop) { ... }
```

---

### 2. **api.toggle-schedule.ts** ❌→✅
**Issue:** Type error - `findMany()` returns array, but code uses `.isEnabled` property
```typescript
// BEFORE (Crashes)
const schedule = await prisma.emailSchedule.findMany({...});
if (!schedule) { ... }
await prisma.emailSchedule.update({
  where: { shop },  // WRONG KEY - only works with 1 schedule
  data: { isEnabled: !schedule.isEnabled, ... }  // ERROR: schedule is array
})

// AFTER (Fixed)
const { scheduleId } = requestBody;
const schedule = await prisma.emailSchedule.findUnique({
  where: { id: scheduleId }
});
await prisma.emailSchedule.update({
  where: { id: scheduleId },  // Use schedule ID, not shop
  data: { isEnabled: !schedule.isEnabled, ... }
}
```

---

### 3. **api.schedule.ts** ❌→✅
**Issue:** `upsert` with only `shop` as key prevents multiple schedules
```typescript
// BEFORE (Only 1 schedule per shop)
await prisma.emailSchedule.upsert({
  where: { shop },  // Overwrites previous schedule!
  update: { ... },
  create: { ... }
});

// AFTER (Multiple schedules supported)
const scheduleId = url.searchParams.get("scheduleId");
if (scheduleId) {
  // Update existing
  await prisma.emailSchedule.update({
    where: { id: scheduleId },
    data: { ... }
  });
} else {
  // Create new
  await prisma.emailSchedule.create({
    data: {
      shop,
      name: `Schedule ${new Date().toLocaleDateString()}`,
      ...
    }
  });
}
```

---

### 4. **app.orders.tsx** ❌→✅
**Issue:** Component expects single schedule but receives array
```typescript
// BEFORE (Type error)
const schedule = await prisma.emailSchedule.findMany({...});
return Response.json({ schedule });

// In component:
const { schedule } = useLoaderData() as { schedule: EmailSchedule | null };

// AFTER (Handles multiple)
const schedules = await prisma.emailSchedule.findMany({...});
return Response.json({ schedules });

// In component:
const { schedules } = useLoaderData() as { schedules: EmailSchedule[] };
const schedule = schedules?.[0] || null;  // Use first schedule or null
```

---

### 5. **Function Updates** (app.orders.tsx)
Added schedule ID to API calls:

**downloadReport():**
```typescript
// BEFORE
const res = await fetch("/api/download-report");

// AFTER
const res = await fetch(`/api/download-report?scheduleId=${schedule?.id}`);
```

**toggleScheduleStatus():**
```typescript
// BEFORE
const res = await fetch("/api/toggle-schedule", { method: "POST" });

// AFTER
const res = await fetch("/api/toggle-schedule", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ scheduleId: schedule?.id })
});
```

**Save button:**
```typescript
// BEFORE
await fetch("/api/schedule", { /* ... */ });

// AFTER
const scheduleIdParam = editingScheduleId ? `?scheduleId=${editingScheduleId}` : "";
await fetch(`/api/schedule${scheduleIdParam}`, { /* ... */ });
```

---

## What Changed

| Component | Change | Impact |
|-----------|--------|--------|
| **Schema** | Already supports multiple schedules per shop via unique `id` field | ✅ No changes needed |
| **API endpoints** | Now accept schedule ID parameter | ✅ Can manage individual schedules |
| **Database queries** | Changed from `shop` to `id` as unique identifier | ✅ Multiple schedules per shop |
| **Component state** | Added `editingScheduleId` state | ✅ Can edit specific schedules |
| **UI functions** | Pass schedule ID to API calls | ✅ Correct schedule operations |

---

## Testing the Fix

1. **Create first schedule** → Click "Add Schedule" → Setup schedule → Click "Save"
2. **Create second schedule** → Click "Add Schedule" again → Setup different schedule → Click "Save"
3. **Verify** → You should see both schedules in the "Scheduled Reports" table
4. **Toggle/Download** → Each schedule can be toggled and downloaded independently

---

## Database Query Examples

**Get all schedules for a shop:**
```sql
SELECT * FROM EmailSchedule WHERE shop = 'myshop.myshopify.com'
```

**Toggle a specific schedule:**
```sql
UPDATE EmailSchedule SET isEnabled = NOT isEnabled WHERE id = 'uuid'
```

**All operations now properly use schedule ID instead of shop name!**
