# Real-phone test checklist

For the owner or a tester. Do this on a real Android phone (ideally a low-end one with 2–3 GB RAM, Chrome) and, if possible, an iPhone (Safari). Use the Vercel link from the `main` branch. **Use demo data or test entries only, never real customer data on a preview** (D14).

Tick each line. If something fails, write down what you did and take a screenshot.

## A. Install and first run
- [ ] Open the link in Chrome. The landing page shows; "অ্যাপ খুলুন" opens the app.
- [ ] Install the app:
  - **Android:** the install card on home, or Chrome ⋮ → "অ্যাপ ইনস্টল করুন"
  - **iPhone:** Share → Add to Home Screen
- [ ] The home-screen icon is the new logo. The app opens full-screen, with no browser bar.
- [ ] **New phone:** Welcome → "আমার খাতা শুরু করুন" → shop setup → an empty khata with your opening cash.
- [ ] **Phone that used the earlier preview:** the "এই ফোনে আগের হিসাব আছে" choice screen appears once.

## B. Offline (the main promise)
- [ ] Turn on **airplane mode**, then close the app completely and open it again from the icon. The home screen loads.
- [ ] Offline:
  - [ ] record a sale, a purchase, a due collection (বাকি আদায়) and an expense
  - [ ] open বাকির খাতা → a party → নিচ্ছি → save
  - [ ] the pill shows **অফলাইন**; tap it, and it says everything is saved on this phone
- [ ] **Airplane mode during a save:** start a sale, switch airplane mode on, then tap save. It's saved (the form closes and the numbers update).
- [ ] **App killed mid-form:** type in a form, swipe the app away, reopen. The app opens normally and nothing half-saved appears.
- [ ] Turn airplane mode off. Nothing is duplicated and every entry is still there.

## C. Everyday use
- [ ] The phone's **back button**:
  - closes an open form (it asks first if you typed something)
  - leaves a party
  - goes back to the previous screen
  - from home, exits the app
- [ ] **"+"** in the bottom bar opens বেচা / কেনা / বাকি আদায় / পরিশোধ / খরচ.
- [ ] **"আরও"** lists every other screen.
- [ ] **তাগাদা পাঠান** on a customer who owes money: WhatsApp opens with the message, and SMS too.
- [ ] Selling more than the stock shows the yellow warning and still saves. The stock screen shows the negative stock in red.
- [ ] Edit an entry with a reason. The detail shows the history with before → after.

## D. Data safety
- [ ] সেটিংস → ব্যাকআপ ডাউনলোড. The file is saved. Send it to yourself (WhatsApp or Google Drive).
- [ ] Uninstall the app (or clear site data), install again → Welcome → "ফিরিয়ে আনুন" → pick the file → everything is back.
- [ ] A password backup asks for the password; a wrong password is refused.
- [ ] সেটিংস shows "ফোনে স্থায়ী সংরক্ষণ: চালু". If it says "চালু হয়নি", note the phone model.

## E. Updates
- [ ] After a new version is deployed, open the app online. The "নতুন আপডেট আছে" banner appears. Tap "আপডেট করুন": the app reloads, and the data is unchanged.

## F. Speed (low-end phone)
- [ ] The app opens in about 3 seconds or less.
- [ ] Saving a sale closes the form and updates home almost instantly.
- [ ] Typing in বাকির খাতা search feels instant.

Note the phone model, Android version and Chrome version here: ______________________
