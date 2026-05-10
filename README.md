# Clothshop

Clothshop is a coursework e-commerce application for browsing clothing products, managing a cart, placing orders, and running store administration workflows. It is built as a Laravel backend API with a React single-page frontend served under `/clothshop`.

## What This Project Does

- Public storefront with product search, category filtering, sorting, product detail pages, and variant selection.
- User authentication with registration, login, logout, remember-me support, current-user session checks, and case-sensitive username/email lookup.
- Email verification using Mailtrap-delivered 6-digit OTP codes.
- Password reset flow with branded reset emails, reset-token validation, and neutral responses for privacy.
- Authenticated cart operations: add items, update quantities, remove items, and apply/remove loyalty coupons.
- Checkout for verified customers with delivery details, payment method selection, stock validation, stock decrement, and order creation inside a transaction.
- Stripe Checkout sandbox support for online test payments, including confirm and webhook handling.
- User profile with avatar upload/removal, order history, email verification state, credit score, and loyalty coupon history.
- Admin dashboard for store operations, including products, variants, orders, users, staff invitations, hero boards, coupons, inventory adjustments, notifications, reports, and audit logs.

## Tech Stack

- Backend: Laravel 10, PHP 8.1+, Eloquent ORM, Laravel Sanctum session authentication.
- Frontend: React, React Router, Vite, Axios, Lucide icons.
- Database: MySQL by default for local development; sqlite in-memory for automated tests.
- Payments: Stripe Checkout sandbox.
- Email: SMTP/Mailtrap for verification and reset emails.
- Testing: PHPUnit feature/unit tests and Playwright E2E browser tests.

## Application Architecture

- `routes/web.php` serves the React SPA shell for `/clothshop` and nested SPA paths.
- `routes/api.php` exposes JSON API endpoints for auth, products, cart, checkout, profile, orders, admin workflows, Stripe, and public marketing boards.
- `resources/js/spa/main.jsx` mounts the React app with `BrowserRouter` using `basename="/clothshop"`.
- `resources/js/spa` contains customer pages, admin pages, cart/checkout context, shared navigation, footer, and utility helpers.
- `app/Http/Controllers/Api` contains the API controllers.
- `app/Models` contains the domain models, including users, products, variants, carts, orders, coupons, boards, inventory adjustments, audit logs, and staff invitations.
- `database/migrations` defines the persistent schema.
- `tests/Feature` and `tests/Unit` contain the PHPUnit automated tests.
- `e2e` contains Playwright browser tests for admin board UX.

## Customer Features

- Browse active products and variants.
- Search by product text, filter by category, and sort by price.
- View product details and select available size/color variants.
- Register, verify email by OTP, sign in, sign out, and reset forgotten passwords.
- Maintain a cart tied to the authenticated user.
- Checkout with delivery name, phone, date/time, address fields, and payment method.
- Pay on delivery or use Stripe sandbox online payment.
- View profile, avatar, order history, credit score, and loyalty rewards.

## Admin Features

Admin access is permission-based. The role and permission payload is returned by `/api/me`.

- Super Admin: full admin access, including users, roles, staff invitations, audit logs, products, orders, reports, coupons, boards, inventory, and notifications.
- Manager: operational access to orders, catalog, marketing, loyalty, inventory, reports, and notifications.
- Support: order and notification access.
- Inventory Admin: catalog, inventory, reports, and notification access.

Admin modules include:

- Dashboard metrics and recent orders.
- Product and variant CRUD with image upload/replacement/removal.
- Order filtering, detail view, and status updates.
- User search, role/status management, and activity timeline.
- Staff invitation creation, cancellation, and acceptance.
- Hero board/marketing banner management with activation, duplication, priority shifting, and undo-friendly UX.
- Coupon grant/expiry/reactivation workflows.
- Inventory variant lookup and stock adjustment history.
- Notification review workflow and review archive.
- Sales/customer/product/inventory reports.
- Audit log viewer for admin mutations.

## Credit Score, Loyalty, and Roles

- Credit score increases by an order's `total_amount_mmk` only after the order is paid.
- Checkout with on-delivery payment creates a pending order; credit is awarded later when an admin marks the order paid.
- Stripe Checkout success marks the order paid and awards credit once.
- At 500,000 MMK credit score, the user receives a one-time `LOYAL10-{user_id}` coupon for 10% off in the cart.
- Reward tiers are designed to create one coupon per user per threshold.
- Admin users cannot use cart or checkout purchase endpoints.

## Currency

- Display currency is MMK.
- Product, cart, checkout, order, coupon, inventory, and report APIs use integer `*_mmk` values where money is exposed.
- Legacy decimal money columns are retained for compatibility while current writes also populate integer MMK columns.
- Backend money helper: `App\Support\MmkMoney`.
- Frontend money helper: `resources/js/spa/utils/money.js`.

## Main API Endpoints

Public:

- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/verify-email-code`
- `POST /api/auth/resend-email-code`
- `POST /api/auth/forgot-password`
- `POST /api/auth/validate-reset-token`
- `POST /api/auth/reset-password`
- `POST /api/staff-invitations/accept`
- `GET /api/products`
- `GET /api/products/{product}`
- `GET /api/boards/active`
- `POST /api/stripe/webhook`

Authenticated:

- `GET /api/me`
- `POST /api/auth/logout`
- `POST /api/me/avatar`
- `DELETE /api/me/avatar`
- `GET /api/orders`
- `GET /api/orders/{order}`
- `POST /api/orders/{order}/stripe-checkout`
- `POST /api/orders/stripe-confirm`
- `GET /api/cart`
- `POST /api/cart`
- `POST /api/cart/coupon`
- `DELETE /api/cart/coupon`
- `PATCH /api/cart/{cartItem}`
- `DELETE /api/cart/{cartItem}`
- `POST /api/checkout`

Admin:

- `GET /api/admin/dashboard`
- `GET /api/admin/products`
- `POST /api/admin/products`
- `GET /api/admin/products/{product}`
- `PUT /api/admin/products/{product}`
- `DELETE /api/admin/products/{product}`
- `POST /api/admin/products/{product}/variants`
- `PUT /api/admin/product-variants/{variant}`
- `DELETE /api/admin/product-variants/{variant}`
- `GET /api/admin/orders`
- `GET /api/admin/orders/{order}`
- `PATCH /api/admin/orders/{order}/status`
- `GET /api/admin/users`
- `GET /api/admin/users/{user}`
- `PATCH /api/admin/users/{user}/status`
- `PATCH /api/admin/users/{user}/role`
- `GET /api/admin/staff-invitations`
- `POST /api/admin/staff-invitations`
- `PATCH /api/admin/staff-invitations/{staffInvitation}/cancel`
- `GET /api/admin/boards`
- `POST /api/admin/boards`
- `PUT /api/admin/boards/{board}`
- `DELETE /api/admin/boards/{board}`
- `POST /api/admin/boards/{board}/duplicate`
- `POST /api/admin/boards/{board}/toggle-active`
- `POST /api/admin/boards/{board}/shift-priority`
- `GET /api/admin/coupons`
- `POST /api/admin/coupons`
- `GET /api/admin/coupons/{coupon}`
- `PATCH /api/admin/coupons/{coupon}/expire`
- `PATCH /api/admin/coupons/{coupon}/reactivate`
- `GET /api/admin/inventory-variants`
- `GET /api/admin/inventory-adjustments`
- `POST /api/admin/inventory-adjustments`
- `GET /api/admin/inventory-adjustments/{inventoryAdjustment}`
- `GET /api/admin/notifications`
- `GET /api/admin/notifications/reviews`
- `POST /api/admin/notifications/bulk-review`
- `POST /api/admin/notifications/{notificationId}/review`
- `GET /api/admin/reports`
- `GET /api/admin/audit-logs`
- `GET /api/admin/audit-logs/{auditLog}`

## Local Setup

1. Clone the repository and move into the project root.
2. Install PHP dependencies:

   ```bash
   composer install
   ```

3. Install JS dependencies:

   ```bash
   npm install
   ```

4. Create and configure the environment file:

   ```bash
   cp .env.example .env
   # On Windows PowerShell:
   copy .env.example .env
   php artisan key:generate
   ```

5. Update database credentials in `.env`.
6. Run migrations and seed sample products:

   ```bash
   php artisan migrate --seed
   ```

7. Link storage for uploaded avatars and product/board images:

   ```bash
   php artisan storage:link
   ```

8. Run the application:

   ```bash
   php artisan serve
   npm run dev
   ```

Open `http://127.0.0.1:8000/clothshop`.

## Mailtrap Email Setup

Password reset and email verification code emails use SMTP. In `.env`, paste the SMTP username and password from your Mailtrap inbox:

```env
MAIL_MAILER=smtp
MAIL_HOST=sandbox.smtp.mailtrap.io
MAIL_PORT=2525
MAIL_USERNAME=your_mailtrap_username
MAIL_PASSWORD=your_mailtrap_password
MAIL_ENCRYPTION=null
MAIL_FROM_ADDRESS="noreply@clothshop.test"
MAIL_FROM_NAME="Clothshop"
```

Make sure `APP_URL` points to the Laravel app URL that should open reset links:

```env
APP_URL=http://127.0.0.1:8000
```

After changing mail or app URL settings:

```bash
php artisan config:clear
```

## Stripe Sandbox Setup

Stripe Checkout sandbox uses test keys only. Add these values to `.env`:

```env
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_local_or_dashboard_secret
STRIPE_CURRENCY=usd
```

Because the shop displays MMK while Stripe sandbox charges USD, Stripe amounts use the existing legacy USD equivalent from `MMK_PER_USD`.

For local webhook testing with the Stripe CLI:

```bash
stripe listen --forward-to http://127.0.0.1:8000/api/stripe/webhook
```

## Running Tests

Run the PHPUnit test suite:

```bash
php artisan test
```

Run the production frontend build:

```bash
npm run build
```

Run Playwright E2E tests after the Laravel app and Vite dev server are running:

```bash
npm run test:e2e
```

The E2E suite targets `PLAYWRIGHT_BASE_URL` and defaults to `http://127.0.0.1:8000/clothshop/`. The Playwright config normalizes the base URL with a trailing slash so relative SPA paths resolve under `/clothshop`. It requires these environment variables:

```env
E2E_ADMIN_USERNAME=your_admin_username
E2E_ADMIN_PASSWORD=your_admin_password
E2E_CUSTOMER_USERNAME=your_verified_customer_username
E2E_CUSTOMER_PASSWORD=your_verified_customer_password
```

Without credentials, public storefront/auth-validation tests still run; authenticated customer and admin tests are skipped.

If Playwright browsers are not installed locally, install Chromium first:

```bash
npx playwright install chromium
```

## Current Limitations

- Online card payment is configured for Stripe sandbox only; live payment keys and production payment operations are not included.
- Deployment instructions for `mi-linux.wlv.ac.uk` or another production server are not included in this repository.
- Playwright E2E tests require a running local app and an existing admin account.

## License

This project is intended for educational/coursework use.
