//https://apis.mappls.com/console/#/app/project/project-details?Id=prj1758564589i1022248480//
//https://console.firebase.google.com/project/evcharge-ff33f/settings/general//


# EVCharge Backend

Backend service for **Electric Vehicle Recharge Bunk** project.  
Built with **Node.js, Express, Firebase, Stripe/Razorpay, Map APIs**.

---

## FeaturesCloud base database
- Firebase
- Profile management
- Admin management of EV bunks & slots
- Slot booking with availability checks
- Payment flow (Stripe / Razorpay)
- Nearby bunk search using Haversine distance
- Notifications (push & email)
- Logging with Winston
- Unit tests with Jest + Supertest

---

## Tech Stack
- Node.js
- Firebase Admin SDK (Auth, Firestore)
- Stripe or Razorpay for payments
- Google Maps / Mapbox for location
- Nodemailer for email notifications
- Winston for logging

---

## Setup

### Prerequisites
- Node.js v16+
- Firebase project with Firestore enabled
- Service Account JSON for Firebase Admin
- Stripe or Razorpay test account
- maaple india Maps API key or Mapbox key

EVCharge backend fresh skeleton.
- Start: npm install && npm run dev
- Copy service-account.json into backend/ for Firebase admin OR set env vars.
- Fill .env from .env.example for SMTP and web API key.

## Setup

open two terminals

#  Fiest terminals
In root folder
cd frotned        :-
npm run dev

# Second Ternimals
cd backend       :-
npm run dev

# Admin Login
Email :- jeevank444patil@gmail.com
password :- Jeevan@87

# onwer login or create it
email :-adi@example1111.com
pass :- 123456

# reanme .env.example to .env files

# igonre warning 