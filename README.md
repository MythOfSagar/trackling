# Little Again

Little Again helps you remember when something last happened. Create a moment for a habit, an item, a personal milestone, or anything else you want to keep track of, then add entries over time.

Your moments and entries are stored locally on your device. The app does not send them to a server.

## Features

- **Track moments:** Give each moment a name, description, category, icon, and color. Edit or delete moments whenever you need to.
- **Record entries:** Add an entry with its date and time, a title, an optional description, and an optional number. Dates can be in the past, so you can add something you did or bought years ago. The current time and moment name are prefilled for quick saving.
- **Browse your timeline:** See entries in chronological order and switch between your moments and your activity timeline.
- **Review history:** Open a moment to see its recent entries, or browse and search its full history. Entries can be edited or deleted.
- **Use the calendar:** See which days have entries, move between months, and add an entry to a selected date.
- **View statistics:** Review entry counts, current and longest runs, average interval, shortest interval, longest gap, average numeric value, monthly activity, and the first and most recent recorded dates.
- **Search locally:** Find moments and entries by name, category, title, description, or date.
- **Set reminders:** Enable repeating local notifications for individual moments. Choose an interval in minutes, hours, days, weeks, months, or years, and set a default interval for new reminders. Month and year intervals are approximated as 30 and 365 days. Reminders can also be paused globally in Settings.
- **Add an Android home-screen widget:** Pin a moment to your Android launcher to see its name and time since the last entry. The widget can be resized and configured for a chosen moment.
- **Make the app yours:** Choose light or dark appearance and a 12-hour or 24-hour clock.
- **Back up your data:** Export moments, categories, and entries as a JSON file, then import a backup later. Import adds records to the existing local data and skips duplicates.
- **Navigate with gestures:** Swipe horizontally to go back from non-home screens.

## Platforms

Little Again is built with Expo, React Native, and Expo Router for Android, iOS, and web. The home-screen widget is Android-only. Local notifications require a native app build; they are not scheduled on web or in Expo Go.

## Development

Install dependencies:

```bash
npm install
```

Start the Expo development server:

```bash
npx expo start
```

For native features such as Android widgets and local notifications, use a development build or an installed app build rather than Expo Go. This project uses Continuous Native Generation; configure native behavior through `app.json` and Expo config plugins.

Useful checks:

```bash
npm run lint
npx tsc --noEmit
npx expo-doctor
```
