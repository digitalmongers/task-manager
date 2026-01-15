# Frontend Guide: AI Boosts & Plan Display

This guide explains how to display the new AI Boost system, specifically handling the difference between **Monthly Caps** and **Yearly "Banked" Quotas**.

## 1. User Profile Data Structure

Every time you fetch the user profile (e.g., via `GET /auth/me` or during Login), the `user` object now contains a specialized `boosts` object.
 
### The `boosts` Object
This object provides all the pre-calculated logic you need for the UI.

```json
{
  "user": {
    "_id": "695f5e766bc293...",
    "plan": "STARTER",
    "billingCycle": "YEARLY",
    "boosts": {
      "total": 12000,
      "remaining": 11450,
      "monthlyLimit": 1000,
      "monthlyUsed": 550,
      "monthlyRemaining": 450,
      "nextResetDate": "2026-02-08T07:36:22.476Z",
      "isMonthlyLimitReached": false
    }
  }
}
```

### Field Descriptions
| Field | Type | Description |
| :--- | :--- | :--- |
| `total` | Number | The full quota for the billing period (12,000 for yearly, 1,000 for monthly). |
| `remaining` | Number | Total boosts left in the account bank. |
| `monthlyLimit` | Number | The maximum boosts allowed per month (The Cap). |
| `monthlyUsed` | Number | How many boosts used in the CURRENT monthly cycle. |
| `monthlyRemaining` | Number | How many boosts left for THIS month before hitting the cap. |
| `nextResetDate` | Date | When the `monthlyUsed` will reset to 0 and the cap will be lifted. |
| `isMonthlyLimitReached`| Boolean | `true` if `monthlyUsed >= monthlyLimit`. Use this to disable AI buttons. |

---

## 2. Monthly vs Yearly UI Logic

The `boosts` object structure is identical for both plans to simplify your frontend code, but the values behave differently:

### Case A: Monthly Plan (e.g., Starter Monthly)
- `total` and `monthlyLimit` will be **Identical** (e.g., 1,000).
- **UI Tip**: For monthly users, the "Total Bank" and "Monthly Usage" represent the same thing. You can choose to show just one progress bar to keep it clean.

### Case B: Yearly Plan (e.g., Starter Yearly)
- `total` is the large annual bank (e.g., 12,020).
- `monthlyLimit` is the monthly cap (e.g., 1,000).
- **UI Tip**: You **MUST** show both. The Progress Bar should track the 1,000 monthly cap, and a separate label should show the `total` remaining in the bank.

---

## 3. Recommended UI Implementation

### Progress Bar (Monthly Usage)
Users care about their immediate limit. Show a progress bar based on monthly data.
- **Label**: `Monthly Usage: 550 / 1,000`
- **Percentage**: `(monthlyUsed / monthlyLimit) * 100`
- **Warning**: If `isMonthlyLimitReached` is true, change bar color to Red.

### Account Summary (Yearly Bank)
For yearly users, show their "Saving Account" of boosts.
- **Label**: `Total Bank: 11,450 / 12,000 remaining`
- **Subtext**: "Next refresh on Feb 8"

---

## 3. Real-time Updates (WebSockets)

When a user performs an AI action, the backend emits a `user:updated` event. Update your local state with these values to keep the progress bar moving without a page refresh.

**Event**: `user:updated`
```json
{
  "_id": "user_id",
  "usedBoosts": 551,
  "totalBoosts": 12000,
  "monthlyUsedBoosts": 551,
  "monthlyLimit": 1000,
  "aiUsageBlocked": false
}
```

## 4. Error Handling

If a user hits their monthly cap, the AI endpoint will return a **403 Forbidden** or **400 Bad Request** with a message like:
> "You have reached your monthly limit of 1000 boosts. Your yearly plan gives you more, but they are released monthly."

You should catch this and show a popup/toast explaining the monthly cap vs. yearly bank logic.
