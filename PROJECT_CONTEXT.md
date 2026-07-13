# Snooker Arena Management System - Project Context

## 1. Project Overview

Snooker Arena Management System is a frontend-only React application for running a snooker club. Operators use it to start and manage table sessions, add games or timed play, attach cafe and accessories charges, end sessions, manage unpaid customer bills, receive payments, record expenses, and close business days. Admin pages review sales, expenses, profit/loss, day history, table history, menu items, and reset tools.

The project currently has no backend, database, server authentication, or API layer. Business data is stored in browser `localStorage` through Zustand persistence and a small custom floor-plan persistence helper. This means all records are browser-local unless the browser profile is shared or exported outside the app.

Current maturity: functional local prototype/business app with many implemented workflows and legacy compatibility fallbacks, but not production-hardened for multi-device, secure authentication, server-side locking, or audit-grade accounting.

Primary workflows:

| Workflow | Current implementation |
| --- | --- |
| Table management | 7 standard tables and 2 private rooms are shown in dashboard grid and floor plan. |
| Sessions | Operators start, pause/resume, edit, cancel, add charge lines, and end table sessions. |
| Billing | Ending a session creates or updates pending/open bills and table history. |
| Payments | Payments create `Sale` records and link to active business day when required. |
| Cafe | Cafe items can be attached to running table players, waiting customers, or open bills. |
| Accessories | Accessories can be sold immediately or attached to running/open bills. |
| Expenses | Expenses are recorded with category, amount, payment method, business day, and active/cancelled status. |
| Business day | Operators start a day with opening cash and close it with counted cash and handover numbers. |

## 2. Tech Stack

| Area | Actual dependency/implementation |
| --- | --- |
| UI framework | React `^19.2.7` |
| Language | TypeScript `~6.0.2` |
| Build/dev | Vite `^8.1.1`, `@vitejs/plugin-react`, `@tailwindcss/vite` |
| Routing | `react-router-dom` `^7.18.1` |
| State | Zustand `^5.0.14`, including `zustand/middleware` persistence |
| Styling | Tailwind CSS `^4.3.2`, shadcn-style local UI components in `src/components/ui` |
| Icons | `lucide-react` |
| Forms/validation | `react-hook-form`, `@hookform/resolvers`, `zod` are installed. Some current pages also use direct local state. |
| Utility styling | `clsx`, `tailwind-merge`, `class-variance-authority`, `tw-animate-css` |
| Date handling | Native `Date`; no separate date library is installed. |
| Testing | No test runner script is configured in `package.json`. |
| Linting | ESLint script exists: `eslint .` |

Commands from `package.json`:

```bash
npm install
npm run dev
npm run build
npm run lint
npm run preview
```

There is no `npm test` script.

## 3. Project Structure

Important areas:

| Path | Purpose |
| --- | --- |
| `src/app/router.tsx` | All application routes and redirects. |
| `src/store/tableStore.ts` | Core table/session lifecycle, charge lines, pending bill creation, table history creation, customer game charges. |
| `src/types/session.ts` | `Session`, `TableChargeLine`, cafe order item, payment method, session type. |
| `src/types/table.ts` | `Table`, `TableStatus`. |
| `src/data/initialTables.ts` | Default table list: Table 1-7, Private Room 1-2. |
| `src/features/dashboard` | Operator dashboard, table cards, start/end/edit dialogs, table controls. |
| `src/features/billing` | Checkout page, pending bill store, billing dialog, payment method selector. |
| `src/features/customers` | Customer/open-bill page and `CustomerAccount` store. |
| `src/features/cafe` | Cafe POS, cafe menu, waiting customers, saved/attached cafe orders. |
| `src/features/accessories` | Accessories POS and accessories item store. |
| `src/features/expenses` | Expenses page, store, types, reporting helpers. |
| `src/features/business-day` | Business day store, card, day history, cash summary logic. |
| `src/features/table-history` | Ended session history store, page, types. |
| `src/features/sales` | Paid sale store, sales history, sale creation/report helpers. |
| `src/features/reports` | Profit/loss report calculation and page. |
| `src/features/floor-plan` | Drag-positioned floor plan and localStorage persistence for layout. |
| `src/features/admin` | Admin dashboard, menu management, developer reset tools. |

Key files requested by area:

| Area | File |
| --- | --- |
| Operator dashboard | `src/features/dashboard/Dashboard.tsx` |
| Table cards | `src/features/dashboard/components/TableCard.tsx` |
| Customer Bills | `src/features/customers/pages/CustomerBillsPage.tsx` |
| Checkout | `src/features/billing/pages/CheckoutPage.tsx` |
| Table History | `src/features/table-history/pages/TableHistoryPage.tsx` |
| Expenses | `src/features/expenses/pages/ExpensesPage.tsx` |
| Cafe POS | `src/features/cafe/CafePage.tsx` |
| Accessories POS | `src/features/accessories/AccessoriesPage.tsx` |
| Admin | `src/features/admin/AdminDashboard.tsx` |
| Business day logic | `src/features/business-day/utils/businessDaySummary.ts` |
| Session/table store | `src/store/tableStore.ts` |
| Pending billing store | `src/features/billing/store/checkoutStore.ts` |
| Customer bill store | `src/features/customers/store/customerAccountStore.ts` |
| Expense store | `src/features/expenses/store/expensesStore.ts` |
| Shared bill display helpers | `src/features/customers/utils/billDisplay.ts` |

## 4. User Roles and Access

The UI separates operator and admin routes, but there is no real authentication or permission enforcement. Anyone with the app open can navigate directly to `/operator`, `/admin`, and related pages. Business day start/end records store typed operator names (`openedBy`, `closedBy`), and expenses can store `createdByRole`/`createdByName`, but this is record metadata, not security.

Operator areas include dashboard, cafe, accessories, checkout, customer bills, expenses, table history, and day history. Admin areas include sales history, customer bills, profit/loss, expenses, menu management, table history, day history, developer tools, and admin dashboard.

## 5. Main Navigation and Pages

| Page | Route | Purpose/actions |
| --- | --- | --- |
| Operator Dashboard/Floor Overview | `/operator` | Start sessions, pause/resume, add charges, edit/cancel/end sessions, open table history, cafe/accessories, checkout, expenses, admin. Includes grid and floor-plan views. |
| Start Session flow | Dialog from dashboard/floor plan | Choose session type, players/customer data, optional manual end time, creates session and initial charge line. |
| Running Table cards | `TableCard.tsx` | Shows session info, timer, warnings after 25/30 minutes, cafe/accessory entry points, add game/time, edit, cancel, end. |
| Table History | `/operator/table-history`, `/admin/table-history` | Filter ended sessions by table, date, status, session type, search; view details. |
| Customer Bills | `/operator/customer-bills`, `/admin/customer-bills` | Master-detail workspace for unpaid `CustomerAccount` bills. Edit customer, add cafe/accessories, discount, receive payment. |
| Customer Bills / Checkout | `/operator/billing` | Pending, paid, cancelled, and all bill views with filters and payment dialogs for `PendingBill` and sales. |
| Cafe POS | `/operator/cafe` | Add cafe items to table players, waiting customers, or open bills. Can save and attach waiting orders. |
| Accessories POS | `/operator/accessories` | Add/edit accessories, sell immediately, or attach accessories to running/open bills. |
| Expenses | `/operator/expenses`, `/admin/expenses` | Add/edit/cancel/delete expenses, search/filter/sort, summary cards. |
| Admin | `/admin` | Business summary and navigation to admin reports/tools. |
| Business Day/Day History | Card on `/operator`; `/operator/day-history`, `/admin/day-history` | Start/end day, show summaries, historical day rows, payment and expense details. |
| Floor Plan | Dashboard view toggle in `/operator` | Drag tables/zones in edit mode; click available tables to start sessions and payment-pending tables for billing. |
| Sales History | `/admin/sales` | Completed sales, payment totals, search, delete mistaken sales. |
| Profit/Loss | `/admin/profit-loss` | Sales minus active expenses by date range. |
| Menu Management | `/admin/menu` | Add/edit/delete/toggle cafe menu items. |
| Developer Tools | `/admin/developer-tools` | Clear test data or full reset local app data. |

## 6. Tables and Rooms

`src/data/initialTables.ts` defines 9 tables:

- Standard tables: Table 1 through Table 7, type `"table"`.
- Private rooms: Private Room 1 and Private Room 2, type `"private-room"`.

Actual table statuses from `src/types/table.ts`:

| Status | Meaning |
| --- | --- |
| `available` | Table can start a new session or accept a waiting bill attachment. |
| `running` | Active session is in progress. |
| `paused` | Session timer is paused. |
| `payment-pending` | Defined and handled in some UI/store code, but normal `endSession` currently clears the table and creates pending bill records instead of leaving this status. |
| `reserved` | Type exists; no inspected workflow sets it. |
| `maintenance` | Type exists; no inspected workflow sets it. |

Cafe waiting-order attach logic only offers available tables (`status === "available"`). Running, paused, payment-pending, reserved, and maintenance should not accept waiting-bill attachment.

## 7. Session Business Model

A `Session` represents one customer/group using one table. It can hold multiple `tableChargeLines`, cafe order items, accessories represented as cafe-order-like items, player/team data, winner/loser/payer metadata, discount, timing, and paid state.

Lifecycle:

1. Start a session from an available table.
2. Select session type: `single`, `double`, `time`, or `private`.
3. Enter player/customer data; walk-ins are normalized.
4. App creates `Session` with `id` like `SA-...` and an initial `TableChargeLine`.
5. During play, add more single games, double games, or time/booking lines from the table card.
6. Add cafe/accessory charges to the correct player/customer.
7. Pause/resume/edit/cancel if needed.
8. End session. The end dialog asks who lost; loser defaults as payer.
9. `endSession` finalizes charge lines, creates or updates a `PendingBill`, adds a table history record, adds game charges to customer accounts, and clears the table.
10. Payment is received later in Checkout or Customer Bills.
11. Paid records become `Sale` records and history is updated where applicable.

Cancellation of a running session (`cancelSession`) clears the table and cafe table orders without creating a bill.

## 8. Table Charge Lines

`TableChargeLine` in `src/types/session.ts`:

| Field | Meaning |
| --- | --- |
| `id` | Line ID like `TCL-{sessionId}-{Date.now()}`. |
| `sessionId` | Parent session ID. |
| `type` | `singleGame`, `doubleGame`, or `tableBooking`. |
| `label` | Display label such as Single Game, Double Game, Table Booking, Private Room. |
| `startedAt` | ISO string. |
| `endedAt` | ISO string when finalized; undefined for active time line. |
| `durationMinutes` | Number for finalized time lines or `0` for instant game lines. |
| `amount` | Calculated charge. |
| `payerName`, `payerCustomerId`, `loserName`, `winnerName`, `notes` | Optional metadata. |

Supported charge types:

- Single Game: fixed Rs. 300.
- Double Game: fixed Rs. 600.
- Table Booking/Time: Rs. 20/minute for standard table.
- Private Room time: Rs. 25/minute.

Initial line is created in `createInitialChargeLine` inside `src/store/tableStore.ts`. Additional lines are appended through `addTableChargeLine`. If an active `tableBooking` line exists, adding another charge finalizes the previous time line at the current time. Final session end calls `getFinalTableChargeLines`, which finalizes remaining active time lines. Legacy sessions without `tableChargeLines` are handled by generating/finalizing a line based on session type and session start/end.

## 9. Pricing Rules

Pricing is defined in `src/features/pricing/utils/calculateGamePrice.ts` and duplicated for charge-line amount calculation in `src/store/tableStore.ts`.

| Item | Price |
| --- | --- |
| Standard single game | Rs. 300 |
| Standard double game | Rs. 600 |
| Standard table time | Rs. 20/minute, equivalent Rs. 1,200/hour |
| Private room time | Rs. 25/minute, equivalent Rs. 1,500/hour |

Time uses `Math.ceil(diff / 60000)` in `calculateDuration`, so any partial minute is charged as a full minute. In `getChargeLineAmount`, time lines use `Math.max(1, Math.ceil(...))`, so a finalized time charge is at least one minute. This is a real nuance: duration helper can return `0` for zero elapsed time, but charge-line amount forces at least one minute for time lines.

Prices are constants in code, not currently configurable through UI.

## 10. Player, Payer, Loser, and Customer Logic

Walk-in names are normalized and numbered to avoid active duplicate labels. Helpers live in `src/features/sessions/utils/walkInLabel.ts` and player extraction in `src/features/sessions/utils/sessionPlayers.ts`.

Single game:

- Supports one-customer and two-player modes.
- If two players exist, adding a single game asks "Who lost?" and assigns loser/payer metadata to the charge line.
- End-session dialog also asks loser and sets loser as payer by default.

Double game:

- Teams are represented by `teamAPlayers`, `teamBPlayers`, one-name-enough flags, `winningTeam`, `losingTeam`, and payer defaults.
- End dialog asks which team lost and uses first losing-team player as payer.
- Payer split logic is in `src/features/sessions/utils/doubleGameBilling.ts`.

Customer/account logic:

- `CustomerAccount` stores named or walk-in open bills.
- `customerNote` and `phone` can disambiguate customers.
- Display formatting often changes walk-in labels and capitalization; persisted data remains in store fields.

## 11. Billing Model

There are three overlapping billing records:

| Model | Store | Role |
| --- | --- | --- |
| `PendingBill` | `useCheckoutStore` | Ended table session awaiting payment in Checkout. |
| `CustomerAccount` | `useCustomerAccountStore` | Open customer bill workspace for game/cafe/accessory charges. |
| `Sale` | `useSalesStore` | Paid transaction record used for sales/accounting. |

`PendingBill` fields include `id`, `tableId`, `tableName`, `tableType`, `session`, `createdAt`, `status` (`pending` or `cancelled`), `paidPlayerNames`, `staffBillNumber`, cancellation fields.

`CustomerAccount` fields include `customerToken`, optional `staffBillNumber`, customer data, status (`active`/`closed`), payment status (`unpaid`/`paid`), game/cafe/accessory charges, totals, discount, payment metadata, business-day and sale links.

`Sale` fields include invoice number, optional staff bill number, table/customer data, sale type, players, timings, table/cafe totals, discount, grand total, payment method/splits, payment status, business day id, ordered items, and optional customer account data.

Grand total rules:

- Basic session bill: `gameAmount + cafeAmount - discount` in `calculateBill`.
- Customer account bill: `gameCharges + cafeCharges + accessoryCharges - discount`.
- Accessories are not part of `calculateBill`; they are handled through customer account totals or accessory sale records.
- Checkout and Customer Bills contain fallback display/calculation logic for legacy records.

## 12. Customer Bills Page

`src/features/customers/pages/CustomerBillsPage.tsx` is the open-bill management workspace. It shows a searchable master list of unpaid active `CustomerAccount` records with `grandTotal > 0`. It supports URL selection via `customerBillId`.

Actions:

- Select bill in master-detail layout.
- Edit customer name, note, phone.
- Add cafe order via `/operator/cafe?customerBillId=...`.
- Add accessories via `/operator/accessories?customerBillId=...`.
- Review session time proof, game charge cards, cafe charges, accessories charges, totals.
- Apply discount.
- Receive payment with single or split methods.

Important rule: If selected customer is still playing on a running/paused table, payment is blocked until table is ended. Payment also requires an active business day.

This page is not exactly the same as Checkout. It pays `CustomerAccount` bills and creates `Sale` records with `saleType: "customer_bill"`.

## 13. Customer Bills / Checkout Page

`src/features/billing/pages/CheckoutPage.tsx` combines pending bills, customer accounts, cancelled pending bills, and paid sales into a filterable table. It includes:

- Summary cards.
- Pending/Paid/Cancelled/All filters.
- Date filters: all, today, yesterday, this-week, this-month, custom.
- Payment, table, and search filters.
- Result count and filtered totals.
- Bill type labels and "Awaiting Payment" age.
- View & Pay flow using `BillingDialog`.
- Cancel pending bill flow with reason/note.

Difference between pages:

| Page | Main purpose |
| --- | --- |
| Customer Bills | Manage open `CustomerAccount` bills and attach cafe/accessories. |
| Customer Bills / Checkout | Operational checkout list for pending, paid, cancelled, and all bill views. |
| Table History | Historical session ledger; not the payment workspace. |

## 14. Payment and Accounting Rules

Payment methods from `src/types/session.ts`:

- `cash`
- `card`
- `jazzcash`
- `easypaisa`

There is no `bank` payment method in the current type.

Rules confirmed in code:

- Only `Sale` records count as sales.
- Ending a session creates/updates pending/open bill data, not sales.
- Pending bills do not count as received money.
- Cash payments increase cash sales and expected physical cash.
- Card, JazzCash, and Easypaisa increase sales but not expected physical cash.
- Cancelled pending bills do not count as open pending amount.
- Cancelled expenses do not reduce totals.
- Paid customer accounts are closed and cannot appear as unpaid active bills.
- Duplicate player-bill payments are guarded by `paidPlayerNames`.
- Split payment total must equal payable total.
- Payment from Customer Bills and Checkout requires an active business day.

Calculations live mainly in:

- `src/features/business-day/utils/businessDaySummary.ts`
- `src/features/reports/utils/calculateProfitLoss.ts`
- `src/features/sales/utils/salesReports.ts`
- `src/features/sales/utils/createSale.ts`
- `src/features/billing/store/checkoutStore.ts`
- `src/features/customers/pages/CustomerBillsPage.tsx`

## 15. Business Day

Business days are stored in `useBusinessDayStore` (`src/features/business-day/store/businessDayStore.ts`) under `snooker-arena-business-day`.

Start day captures:

- `openedBy`
- `openingCash`
- optional opening notes
- `startedAt`
- status `active`

Close day captures:

- summary snapshot
- `actualCashCounted`
- `cashLeftForStaff`
- `cashTakenHome = actualCashCounted - cashLeftForStaff`
- `cashDifference = actualCashCounted - expectedCash`
- `closedBy`, notes, `endedAt`, status `closed`

Expected cash formula:

```text
Opening Cash + Cash Payments Received - Cash Expenses = Expected Closing Cash
```

Pending bills do not affect received cash. Digital payments do not increase physical cash. Digital expenses do not reduce physical cash. Cancelled expenses are ignored. Negative/short cash is displayed as shortage during close.

Important limitation: closed days store a summary snapshot, but details are still read from current sales/expenses by businessDayId in Day History. Pending bills shown in day details are "currently open", not necessarily a historical snapshot for that day.

## 16. Expenses

Expense model is in `src/features/expenses/types/expense.ts`.

Categories:

- Staff Salary
- Electricity
- Rent
- Maintenance
- Cafe Purchase
- Cleaning
- Internet
- Other

Fields include `id`, `category`, `amount`, `note`, `expenseDate`, `createdAt`, optional `activeBusinessDayId`, `paymentMethod`, optional status (`active`/`cancelled`), cancellation metadata, and creator metadata.

`useExpensesStore` persists to `snooker-arena-expenses`. It supports add, update, hard delete, soft cancel, filtering, and reset. The page supports summary cards such as today's expenses, this month's expenses, total records, highest category, plus search, filters, sorting, result count, and filtered total.

Accounting rules:

- Expenses are separate from sales.
- Active expenses count in expense totals.
- Cash expenses reduce expected cash.
- Digital expenses do not reduce physical cash.
- Cancelled expenses do not affect totals.
- Old expenses without `status` are treated as active by `getExpenseStatus`.

Both soft-cancel (`cancelExpense`) and permanent delete (`deleteExpense`) exist in the store. The page should be checked before changing destructive behavior.

## 17. Cafe POS

`src/features/cafe/CafePage.tsx` and `src/features/cafe/store/cafeStore.ts` implement Cafe POS.

Cafe store contains:

- Menu items from `src/features/cafe/data/menu.ts`.
- Waiting customers.
- Player orders attached to table/session/player.
- Saved cafe orders.

Cafe orders can be:

- Attached to running table players.
- Saved for waiting customers.
- Attached later to an available table.
- Added to an open customer bill.
- Paid as waiting/customer cafe flow where implemented.

`saveOrder` validates customer name and non-empty cart. For table/session orders, saved orders are marked `paymentStatus: "attached"` and mirrored into player orders. Customer account integration uses cafe charges and source order IDs.

Stock handling is not implemented; availability controls whether items appear.

## 18. Accessories POS

Accessories are in `src/features/accessories`.

Default items:

- Cue Tip, Rs. 300
- Cue Stick, Rs. 3500
- Glove, Rs. 800
- Chalk, Rs. 150

Categories: Tips, Sticks, Gloves, Chalk, Other.

Accessories can be:

- Added/edited in POS.
- Attached to running table/player bill.
- Attached to an existing open customer bill.
- Sold immediately as `saleType: "accessories"`.

Accessories are represented as `CustomerAccessoryCharge` in customer accounts and as cafe-order-like items with `[Accessory]` prefix in session/order structures. Immediate accessories sales store amount in `Sale.cafeAmount`, which is a known naming limitation. Table History currently displays an "Accessories Bill: Rs. 0" in detail, so accessories history summary/display is incomplete.

No stock quantity management exists; only `available` toggling exists in the store.

## 19. Table History

`src/features/table-history` records ended table sessions. A record is created during `endSession` and when manually-started sessions include `endTime`.

History page includes:

- Summary cards: total sessions, table bill, cafe bill, grand total.
- Search.
- Table filter.
- Date filter.
- Status filter.
- Session type filter.
- Result count via table rows.
- View Details panel.

Record fields include bill number fallbacks (`billNo`, `displayToken`, `customerToken`, `staffBillNumber`, `invoiceNumber`), players, timings, winner/loser/payer, team fields, payer breakdown, table amount, cafe amount, discount, grand total, payment status, pending bill link, sale link, cancellation fields, cafe items, and player breakdown.

Cancelled records are retained with `paymentStatus: "cancelled"` and excluded from money summary totals. Historical totals are bill/session totals, not necessarily received sales totals.

Known gap: accessories are not separated in `TableHistoryRecord`; accessories may be embedded in `cafeItems`, but detail view hardcodes Accessories Bill as Rs. 0.

## 20. Status Definitions

| Status | Used by | Meaning/effect |
| --- | --- | --- |
| `available` | Table | Can start/attach. |
| `running` | Table | Active session, can pause/add/edit/end/cancel. |
| `paused` | Table | Active session paused, can resume/end/edit. |
| `payment-pending` | Table | Supported by type/UI but not normal end-session result. |
| `reserved` | Table | Defined but no inspected setter. |
| `maintenance` | Table | Defined but no inspected setter. |
| `pending` | PendingBill/TableHistory | Awaiting payment. |
| `cancelled` | PendingBill/TableHistory/Expense | Excluded from open/sales/active totals. |
| `paid` | CustomerAccount/TableHistory/Sale payment status | Completed payment. Sale records use only `paid`. |
| `active` | CustomerAccount/Expense/BusinessDay | Open account, active expense, or open day. |
| `closed` | CustomerAccount/BusinessDay | Paid/closed account or ended day. |
| `unpaid` | CustomerAccount | Open unpaid customer bill. |
| `draft`, `saved`, `paid`, `attached` | Cafe saved order payment status | Draft/saved waiting order, paid order, attached to table/bill. |

Old/inconsistent enum names exist in sale types: `cafe-only` and `cafe_only` are both supported in display logic.

## 21. Data Stores

| Store | Path | Persistence key | Important state/actions |
| --- | --- | --- | --- |
| `useTableStore` | `src/store/tableStore.ts` | Not persisted by Zustand | `tables`; start/update/pause/resume/end/cancel session, update cafe, add charge line, receive payment, reset. |
| `useCheckoutStore` | `src/features/billing/store/checkoutStore.ts` | `snooker-arena-checkout` | `pendingBills`, bill number sequences, add/cancel/update/receive pending bills. |
| `useCustomerAccountStore` | `src/features/customers/store/customerAccountStore.ts` | `snooker-arena-customer-accounts` | Customer accounts, game/cafe/accessory charges, discounts, paid marking, legacy walk-in split/merge helpers. |
| `useSalesStore` | `src/features/sales/store/salesStore.ts` | `snooker-arena-sales` | Sales, invoice sequence, walk-in bill sequences, add/delete/reset. |
| `useCafeStore` | `src/features/cafe/store/cafeStore.ts` | `snooker-arena-cafe` | Menu, waiting customers, player orders, saved orders, menu/order actions. |
| `useAccessoriesStore` | `src/features/accessories/store/accessoriesStore.ts` | `snooker-arena-accessories` | Accessory items and add/update/toggle actions. |
| `useExpensesStore` | `src/features/expenses/store/expensesStore.ts` | `snooker-arena-expenses` | Expenses and add/update/delete/cancel/report/reset actions. |
| `useBusinessDayStore` | `src/features/business-day/store/businessDayStore.ts` | `snooker-arena-business-day` | Business days, start/close/history/notes/reset. |
| `useTableHistoryStore` | `src/features/table-history/store/tableHistoryStore.ts` | `snooker-arena-table-history` | History records and update/filter/reset actions. |
| `useFloorPlanStore` | `src/features/floor-plan/useFloorPlanStore.ts` | Custom keys below | Table/zone positions, reset. |

Risky areas: `useTableStore` is not persisted, so active running sessions are lost on browser refresh unless another mechanism is added. Paid/open historical records persist, but currently running table state does not.

## 22. LocalStorage and Persistence

Known keys:

| Key | Owner | Data |
| --- | --- | --- |
| `snooker-arena-sales` | `useSalesStore` | Paid sales, invoice sequence, bill sequences. |
| `snooker-arena-checkout` | `useCheckoutStore` | Pending bills and checkout bill sequences. |
| `snooker-arena-cafe` | `useCafeStore` | Menu, waiting customers, player orders, saved orders. |
| `snooker-arena-accessories` | `useAccessoriesStore` | Accessory item list. |
| `snooker-arena-expenses` | `useExpensesStore` | Expense records. |
| `snooker-arena-table-history` | `useTableHistoryStore` | Ended session history. |
| `snooker-arena-business-day` | `useBusinessDayStore` | Business day records. |
| `snooker-arena-customer-accounts` | `useCustomerAccountStore` | Open/closed customer account bills and charge records. |
| `snooker-arena-floor-plan-positions` | `useFloorPlanStore` custom helper | Table positions. |
| `snooker-arena-floor-plan-zones` | `useFloorPlanStore` custom helper | Zone positions. |

No explicit versioned migrations are configured in Zustand persist. Backward compatibility is mostly handled by defensive helper functions and optional fields. Cross-tab synchronization is not implemented beyond normal browser storage behavior.

Risks: stale data, duplicate records from repeated actions, invalid timestamps, missing arrays/optional fields, browser-only persistence, refresh loss for active table sessions, and old records with incomplete structure.

## 23. Data Models and Types

Important models:

| Type | Path | Notes |
| --- | --- | --- |
| `Table` | `src/types/table.ts` | `id`, `name`, `type`, `status`, optional `session`. |
| `Session` | `src/types/session.ts` | Table/session type, players, teams, timings, cafe orders, table charge lines, payment fields. |
| `TableChargeLine` | `src/types/session.ts` | Per-game/time charges inside a session. |
| `PendingBill` | `src/features/billing/store/checkoutStore.ts` | Pending/cancelled checkout bill around ended session. |
| `CustomerAccount` | `src/features/customers/types/customerAccount.ts` | Open/closed bill account with game/cafe/accessory charges and totals. |
| `Sale` | `src/features/sales/types/sale.ts` | Paid record used for accounting and history. |
| `PaymentSplit` | `src/features/sales/types/sale.ts` | Split method and amount. |
| `CafeOrderItem` | `src/types/session.ts` | Session/order item structure. |
| `MenuItem`, `OrderItem`, `WaitingCustomer` | `src/features/cafe/types/menu.ts` | Cafe menu and cart/waiting structures. |
| `AccessoryItem` | `src/features/accessories/store/accessoriesStore.ts` | Accessory catalog item. |
| `Expense` | `src/features/expenses/types/expense.ts` | Expense record with category, amount, date, status, payment method. |
| `BusinessDay` | `src/features/business-day/types/businessDay.ts` | Day summary plus opening/closing cash metadata. |
| `TableHistoryRecord` | `src/features/table-history/types/tableHistory.ts` | Ended-session history ledger. |

There is no implemented `User`/`Admin` account type for authentication.

## 24. Shared Helpers

Important helpers:

| Helper/file | Purpose |
| --- | --- |
| `src/features/pricing/utils/calculateDuration.ts` | Duration and rounded total minutes. |
| `src/features/pricing/utils/calculateGamePrice.ts` | Session price calculation. |
| `src/features/pricing/utils/calculateBill.ts` | Game + cafe - discount total. |
| `src/features/customers/utils/billDisplay.ts` | Bill labels, table labels, search text, customer labels. |
| `src/features/sessions/utils/sessionPlayers.ts` | Extract players from session. |
| `src/features/sessions/utils/walkInLabel.ts` | Walk-in display and staff bill number helpers. |
| `src/features/sessions/utils/doubleGameBilling.ts` | Team and payer breakdown logic. |
| `src/features/business-day/utils/businessDaySummary.ts` | Expected cash, pending amount, sales/expense summary. |
| `src/features/expenses/utils/expenseHelpers.ts` | Currency, status, payment labels, dates, active expense handling. |
| `src/features/expenses/utils/expenseReports.ts` | Date/category/total expense reports. |
| `src/features/reports/utils/calculateProfitLoss.ts` | Profit/loss report calculations. |
| `src/features/sales/utils/createSale.ts` | Converts ended table session into `Sale`. |

Duplicated formatting helpers exist in several pages (`formatCurrency`, date labels, customer display labels). Consolidation would reduce inconsistency.

## 25. Routes

Routes from `src/app/router.tsx`:

| Path | Component/behavior |
| --- | --- |
| `/` | Redirects to `/operator`. |
| `/operator` | Operator dashboard. |
| `/operator/cafe` | Cafe POS. |
| `/operator/accessories` | Accessories POS. |
| `/operator/billing` | Checkout. |
| `/operator/customer-bills` | Customer Bills. |
| `/operator/expenses` | Expenses. |
| `/operator/table-history` | Table History. |
| `/operator/day-history` | Day History. |
| `/admin` | Admin dashboard. |
| `/admin/sales` | Sales History. |
| `/admin/customer-bills` | Customer Bills. |
| `/admin/profit-loss` | Profit/Loss. |
| `/admin/expenses` | Expenses. |
| `/admin/menu` | Menu Management. |
| `/admin/table-history` | Table History. |
| `/admin/day-history` | Day History. |
| `/admin/developer-tools` | Developer Tools. |
| `/cafe` | Redirects to `/operator/cafe`. |
| `/sales` | Redirects to `/admin/sales`. |
| `/expenses` | Redirects to `/operator/expenses`. |
| `/checkout` | Redirects to `/operator/billing`. |
| `/reports/profit-loss` | Redirects to `/admin/profit-loss`. |

Known query parameters:

- `customerBillId` in Customer Bills, Cafe POS, Accessories POS.
- `tableId` and `sessionId` in Cafe POS and Accessories POS.
- `tableId` in Table History initial filter.

Invalid IDs generally result in no selection or fallback to the first open bill; there is no dedicated invalid-route page.

## 26. Critical Rules - Do Not Break

1. Same customers should use one running table session.
2. Additional games/time charges must stay inside the same session as charge lines.
3. End Session happens once when customers leave.
4. End Session creates/updates a pending/open bill record.
5. End Session must not count as a sale.
6. Payment received creates a `Sale` and counts as revenue.
7. Fresh sessions must not inherit old customers, cafe orders, or bills.
8. Old pending bills remain in Checkout until paid or cancelled.
9. Waiting bills may attach only to available tables.
10. Running, paused, payment-pending, reserved, and maintenance tables cannot accept waiting bill attachment.
11. Zero-value open customer account drafts must not appear in Customer Bills.
12. Cafe and accessories must attach to the correct customer/account/session/player.
13. Table, cafe, accessories, discounts, and grand totals must reconcile.
14. Paid bills cannot be paid twice.
15. Cancelled bills do not count as open, paid, sales, or received.
16. Cash and digital accounting must remain separate.
17. Cash expenses reduce expected cash.
18. Digital expenses do not reduce physical cash.
19. Legacy records must not crash pages.
20. localStorage data must remain backward compatible.
21. Split payment totals must equal payable total before accepting payment.
22. Payments require an active business day.
23. Customer Bills payment must be blocked while that customer is still playing on a running/paused table.
24. Active time charge lines must be finalized before billing.
25. Running session cancellation should not create a bill.

## 27. Legacy and Backward Compatibility

Confirmed fallback handling:

- Sessions without `tableChargeLines` are converted to a final line when ended/history/customer charges are created.
- Bills without accessories fields are handled with optional arrays and fallback checks.
- Old expenses without `status` are treated as active.
- Walk-in names are normalized via helper logic.
- Missing bill numbers fall back through several fields and display names.
- Invalid or missing timestamps often display as unavailable/dash.
- Sale type supports both `cafe-only` and `cafe_only`.
- Accessory charges can exist both in `accessoryCharges` and older `[Accessory]` cafe charge rows.

Do not destructively rename or remove old optional fields without migration. There is no formal persisted version migration.

## 28. Current Implemented Improvements

Confirmed implemented features:

- Add Game / Time inside a running session.
- Multiple Single Games in one session via `tableChargeLines`.
- Double Game charge line.
- Time/booking charge line with previous active line finalization.
- Mixed-session labels in Customer Bills/Checkout.
- Player/loser/payer tracking.
- Team fields for double games.
- Game-count labels such as `Single Game xN` in some displays.
- Customer Bills master-detail page.
- Checkout filters, result count, and filtered totals.
- Outstanding/pending bill summaries.
- Accessories column/amounts in Checkout and Customer Bills.
- Expense tracking with active/cancelled status.
- Business-day cash calculations.
- Improved Table History with filters/details.
- Display formatting helpers for walk-ins and bills.
- Split payment support.
- Developer reset tools.
- Floor plan with persisted positions.

## 29. Known Issues and Limitations

Confirmed limitations:

- Frontend-only; no backend/database.
- No real authentication or role-based security.
- No multi-device synchronization.
- Active running table sessions are not persisted in `useTableStore`.
- No server-side payment locking.
- No receipt attachment or printable receipt workflow was found.
- No partial payment/refund flow beyond separate player bills and split payment methods.
- No stock quantity tracking for cafe/accessories.
- Accessories are sometimes stored/displayed through cafe-like fields, causing reporting ambiguity.
- Table History details hardcode Accessories Bill as Rs. 0.
- Some pages use wide tables that require horizontal scroll.
- Sales can be deleted from Sales History for mistakes, with no audit log.
- Developer Tools can clear/reset local data.

Suspected or needs verification:

- Checkout page is large and contains duplicated fallback calculations; regressions are possible if models change.
- Manual browser preview was not completed in this documentation pass; code inspection was primary.
- `payment-pending`, `reserved`, and `maintenance` statuses exist but are not fully wired as active workflows.

Future enhancements:

- Backend/API and central database.
- Authentication and permission enforcement.
- Formal migrations/versioning for local data.
- Audit log.
- Receipts, refunds, partial payments.
- Stock management.
- Consolidated accounting helpers and accessory totals in history.

## 30. How To Run The Project

Prerequisites:

- Node.js and npm.

Steps:

```bash
npm install
npm run dev
```

Open the Vite local URL printed by the dev server, usually `http://localhost:5173`.

Production build:

```bash
npm run build
```

Preview build:

```bash
npm run preview
```

Lint:

```bash
npm run lint
```

There is no configured test command.

Local data lives in browser localStorage under the keys listed in section 22. Clearing browser storage or using Developer Tools Full Reset deletes business data for that browser profile. Developer Tools has:

- Clear Test Data: removes business records but keeps settings.
- Full Reset App: removes known storage keys and restores defaults.

Default seeded data includes tables, cafe menu, accessories, and floor-plan positions/zones.

## 31. Manual Test Checklist

- Start business day with operator name and opening cash.
- Start Single Game on a standard table.
- Add another Single Game to the same running session.
- Start Double Game and select losing team on end.
- Start Table Booking/time charge and verify minute-based amount.
- Start/use private room and verify Rs. 25/min.
- Add cafe item to a table player.
- Add accessories to a table player.
- Pause and resume a session.
- Edit session player data.
- Cancel a mistaken running session and confirm no bill is created.
- End session and verify pending bill/open bill.
- Pay cash and verify sale plus expected cash.
- Pay card/JazzCash/Easypaisa and verify sale but not physical cash.
- Verify business-day totals and expected cash.
- Add cash expense and verify expected cash decreases.
- Add digital expense and verify expected cash does not decrease.
- Cancel expense and verify totals exclude it.
- Verify Customer Bills and Checkout totals agree.
- Verify Table History has pending, paid, and cancelled records.
- Refresh browser and confirm persisted records remain.
- Confirm active running sessions are not relied on after refresh.
- Run `npm run build`.

## 32. New Developer Quick Start

Read in this order:

1. `package.json`
2. `src/app/router.tsx`
3. `src/types/session.ts`
4. `src/types/table.ts`
5. `src/store/tableStore.ts`
6. `src/features/billing/store/checkoutStore.ts`
7. `src/features/customers/store/customerAccountStore.ts`
8. `src/features/business-day/store/businessDayStore.ts`
9. `src/features/business-day/utils/businessDaySummary.ts`
10. `src/features/dashboard/Dashboard.tsx`
11. `src/features/dashboard/components/TableCard.tsx`
12. `src/features/customers/pages/CustomerBillsPage.tsx`
13. `src/features/billing/pages/CheckoutPage.tsx`
14. `src/features/table-history/pages/TableHistoryPage.tsx`
15. `src/features/expenses/pages/ExpensesPage.tsx`
16. `src/features/cafe/CafePage.tsx`
17. `src/features/accessories/AccessoriesPage.tsx`

Safest places for UI-only changes:

- Page/component files under `src/features/*/pages` and `src/features/*/components`.
- Shared UI primitives under `src/components/ui`, if the change is design-system-wide.

Files with critical accounting/business logic:

- `src/store/tableStore.ts`
- `src/features/billing/store/checkoutStore.ts`
- `src/features/customers/store/customerAccountStore.ts`
- `src/features/sales/utils/createSale.ts`
- `src/features/business-day/utils/businessDaySummary.ts`
- `src/features/reports/utils/calculateProfitLoss.ts`
- `src/features/expenses/utils/expenseHelpers.ts`

Always retest these flows after changes:

- Start/end session.
- Add multiple charge lines.
- Cafe/accessory attachment.
- Customer Bills payment.
- Checkout payment/cancel.
- Business day expected cash.
- Expense cancel/delete.
- Table History display.
- Refresh persistence behavior.

Common mistakes to avoid:

- Counting pending bills as sales.
- Treating digital payments as physical cash.
- Forgetting accessory totals because they may be stored separately or with `[Accessory]` prefix.
- Breaking legacy optional fields.
- Removing localStorage keys without migration.
- Assuming admin/operator routes are secure.
- Assuming active running sessions survive refresh.
- Changing pricing in one place but not the charge-line helper in `tableStore.ts`.

## Terminal Report

- File created: `PROJECT_CONTEXT.md`
- Repository areas inspected: routing, package/build setup, table/session types and store, checkout store/page/dialogs, customer account store/page/helpers, cafe store/POS, accessories store/POS, expenses store/page/helpers, business-day store/card/history/summary, sales store/types/reports, table-history store/page/types, pricing helpers, admin pages, floor-plan persistence, reset tools.
- Major flows verified by code inspection: start session, add charge line, end session, pending bill creation, customer account charging, checkout payment, customer bill payment, cafe/accessory attachment, expense accounting, business-day cash calculation, table history creation/update, reset tools.
- Uncertain areas: browser preview was not completed in this pass; no automated tests are configured; some statuses and legacy fields are defined but not fully exercised by current UI.
- Application code changed: no application logic was changed. Only documentation was added.
