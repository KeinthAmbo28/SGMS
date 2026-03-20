# Smart Gym Management System (new build)

This is a **fully functional** Smart Gym Management System with:
- **Backend**: Node.js + Express API + JWT auth
- **Database**: SQLite (auto-creates + seeds on first run)
- **Frontend**: Static HTML/CSS/JS UI matching your provided screenshots
- **Member Portal**: Members can register/login, check-in/out, and select an available trainer

## Run it

1) Install dependencies:

```bash
cd "smartgym-system/backend"
npm install
```

2) Start the server:

```bash
cd "smartgym-system/backend"
npm start
```

3) Open in browser:

- **Admin login**: `http://localhost:5050/login.html`
- **Member login**: `http://localhost:5050/memberLogin.html`

## Admin Login

- **Username**: `admin`
- **Password**: `admin123`

## Testing (Unit Tests)

This project uses Node's built-in test runner.

### What’s included
- `backend/test/accountFreeze.test.js`: tests the account-freeze logic (freeze inactive users, respect `include_never_used`, and never freeze `admin` role users).

### Run tests
```bash
cd "smartgym-system/backend"
node --test test/accountFreeze.test.js


## What’s included

- **Admin Dashboard** (`adminDashboard.html`): KPI cards + Attendance line chart + Membership donut + Payments bar + recent activities
- **Members** (`members.html`): create/update/delete + assign trainer
- **Trainers** (`trainers.html`): create/update/delete
- **Attendance** (`attendance.html`): record check-ins + view recent (includes check-out column)
- **Payments** (`payments.html`): record payments + view recent
- **Reports** (`reports.html`): payments by method + top members by check-ins
- **Settings** (`settings.html`, admin): manage users, retrieve users, update member assignments/status, reset all passwords, download backup JSON

### Member Portal

- **Register / Login** (`memberLogin.html`): members create an account and log in
- **Member Dashboard** (`memberDashboard.html`):
  - Check-in / check-out (saved to attendance; visible on admin Attendance page)
  - Select an available trainer (assigns trainer to the member record)
  - View personal attendance history

## Database file

SQLite file is created here on first run:

- `backend/src/db/smartgym.sqlite`

## Notes

- Member accounts are stored in `users` with role `member`, linked to `members` via `member_id`.
- If you change the backend port, set `PORT` in your environment before starting.

