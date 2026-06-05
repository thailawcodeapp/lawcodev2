# Firebase Setup — Juris Voice Cloud Sync

This folder contains Firebase configuration files. To activate cloud sync on
this device you need to:

1. Create the Firebase project
2. Add an Android app with package `com.lawcodev2.app`
3. Drop `google-services.json` into `android/app/`
4. Enable Google Sign-In as an Auth provider
5. Create the Firestore database in **asia-southeast1**
6. Deploy `firestore.rules`

Steps 1–5 are done in the Firebase Console. Step 6 needs the Firebase CLI.

## Cost model

We use a chunked single-document strategy: every data type (notes, memory,
stats, bookmarks, folders) is stored as **one** Firestore document under
`users/{uid}/data/{collection}`. Per user per day this works out to ~6 writes
and ~9 reads, comfortably within the **Spark (free) tier**:

* 20,000 writes/day  → supports ~3,300 active Pro users
* 50,000 reads/day   → supports ~5,500 sign-ins
* 1 GB storage
