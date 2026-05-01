# Clothshop

Clothshop is a coursework e-commerce application for browsing clothing products, managing a cart, and placing orders.  
It is built as a Laravel backend API with a React single-page frontend.

## What This Project Does

- Public product catalog with search, filtering, and sorting
- Product detail pages with size/color variant selection
- User authentication (register, login, logout, current user)
- Email verification with Mailtrap-delivered 6-digit OTP codes
- Authenticated cart operations (add, update quantity, remove)
- Checkout flow with delivery details and payment method selection for verified users
- Order creation with stock checks and stock decrement in a transaction
- Profile page with avatar upload/remove and order history

## Tech Stack

- Backend: Laravel 10, PHP 8.1+, Sanctum (session auth), Eloquent ORM
- Frontend: React, React Router, Vite, Axios, Lucide icons
- Database: MySQL (default local setup), sqlite in-memory for tests
- Testing: PHPUnit feature/unit tests via `php artisan test`

## Credit score & user roles

- **Credit score** increases by the order `total_amount_mmk` when a paid order is completed (once per order; tracked via `orders.credit_awarded_at`).
- Checkout with on-delivery payment creates a pending order; credit is awarded only after the order is later marked paid.
- Stripe Checkout sandbox is available for online test payments; successful Stripe payments mark orders paid and award credit.
- At **500,000 MMK** credit score, the user receives a one-time `LOYAL10-{user_id}` coupon for **10% off** in the cart.
- **Roles**: `User::ROLE_USER` (1) and `User::ROLE_ADMIN` (2). The `/api/me` payload includes `role` and `is_admin`.

## Currency (MMK)

- Display currency is **MMK** (integer kyat, no decimals in the UI).
- Product, cart, checkout, and order APIs expose integer `*_mmk` fields; responses include `currency_code: "MMK"` where relevant.
- Legacy decimal columns (`price`, `unit_price`, `total_amount`, etc.) are retained for transition; new writes also populate these using `MMK_PER_USD` (default **2100**) where backward-compatible strings are needed.
- Shared backend helper: `App\Support\MmkMoney`. Shared frontend formatting: `resources/js/spa/utils/money.js` (`formatMMK`, `toIntegerMMK`).

## Project Structure

- `routes/web.php`: catch-all route that serves the SPA shell
- `routes/api.php`: JSON API routes for auth, products, cart, checkout, profile, orders
- `app/Http/Controllers/Api`: API controllers
- `app/Models`: domain models (`Product`, `ProductVariant`, `Cart`, `Order`, etc.)
- `app/Support/MmkMoney.php`: integer MMK helpers (conversion for legacy USD decimals)
- `resources/js/spa`: React SPA pages/components
- `resources/views/spa.blade.php`: SPA entry view
- `tests/Feature`: API and auth feature tests

## Footer Information Block

The SPA includes a global footer shown across pages with the following content groups:

- **Brand**: Clothshop + short brand message
- **Shop**: links to Shop, Cart, Checkout, and Profile
- **Help**: links to Contact, Shipping & Delivery, Returns, and FAQ pages
- **Legal**: links to Privacy Policy and Terms of Service pages
- **Follow**: external links to Instagram, Facebook, and TikTok
- **Trust**: secure checkout note
- **Copyright**: `© 2026 Clothshop. All rights reserved.`

Footer-linked internal pages are routed in the SPA as:

- `/contact`
- `/shipping-delivery`
- `/returns`
- `/faq`
- `/privacy-policy`
- `/terms-of-service`

## Main API Endpoints

Public:

- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/verify-email-code`
- `POST /api/auth/resend-email-code`
- `POST /api/auth/forgot-password`
- `POST /api/auth/validate-reset-token`
- `POST /api/auth/reset-password`
- `GET /api/products`
- `GET /api/products/{product}`

Authenticated (`auth:sanctum`):

- `GET /api/me`
- `POST /api/auth/logout`
- `POST /api/me/avatar`
- `DELETE /api/me/avatar`
- `GET /api/orders`
- `GET /api/cart`
- `POST /api/cart`
- `PATCH /api/cart/{cartItem}`
- `DELETE /api/cart/{cartItem}`
- `POST /api/checkout`

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

4. Create and configure environment file:

   ```bash
   cp .env.example .env
   # On Windows PowerShell, use:
   # copy .env.example .env
   php artisan key:generate
   ```

5. Update database credentials in `.env` (MySQL by default).
6. Run migrations and seed sample products:

   ```bash
   php artisan migrate --seed
   ```

7. Link storage for uploaded avatars:

   ```bash
   php artisan storage:link
   ```

8. Run the application:

   ```bash
   php artisan serve
   npm run dev
   ```

Open the app in your browser (using your local Laravel URL).  
The SPA is configured with a base path of `/clothshop`.

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

Make sure `APP_URL` points to the Laravel app URL that should open reset links, for example:

```env
APP_URL=http://127.0.0.1:8000
```

After changing mail or app URL settings, clear cached config:

```bash
php artisan config:clear
```

## Stripe Sandbox Payment Setup

Stripe Checkout sandbox uses test keys only. Add your Stripe secret key and webhook signing secret to `.env`:

```env
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_local_or_dashboard_secret
STRIPE_CURRENCY=usd
```

Because the shop displays MMK while Stripe sandbox charges USD, the Stripe amount uses the existing legacy USD equivalent from `MMK_PER_USD`.

For local webhook testing with the Stripe CLI:

```bash
stripe listen --forward-to http://127.0.0.1:8000/api/stripe/webhook
```

## Running Tests

Run all tests:

```bash
php artisan test
```

## Current Limitations

- Online payment is Stripe sandbox only; live payments are not configured.
- No admin dashboard for product/order management.
- README documents current implementation only; deployment instructions are not included.

## License

This project is intended for educational/coursework use.
