# קנייה חכמה 🛒

אפליקציית רשימת קניות משפחתית: רשימה פעילה לסופר, מלאי הבית, ורשימות קבועות — משותפת לכל המשפחה דרך קוד הצטרפות, עם שמירה ב-MongoDB וסנכרון אוטומטי בין המכשירים.

## מה צריך (הכל בחינם)

- חשבון [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) — בסיס הנתונים בענן
- חשבון [GitHub](https://github.com/signup) — לאחסון הקוד
- חשבון [Render](https://render.com) — להרצת האפליקציה באינטרנט
- להרצה מקומית בלבד: [Node.js](https://nodejs.org) גרסה 18 ומעלה

---

## שלב 1: הקמת בסיס הנתונים (MongoDB Atlas)

1. הירשמו ל-MongoDB Atlas וצרו פרויקט חדש.
2. לחצו **Build a Database** ובחרו את התוכנית החינמית **M0 Free**. בחרו אזור קרוב (למשל Frankfurt) ולחצו Create.
3. במסך האבטחה שנפתח:
   - צרו משתמש: בחרו שם משתמש וסיסמה **ושמרו אותם בצד** (בלי תווים מיוחדים בסיסמה — יחסוך כאבי ראש).
   - ב-Network Access לחצו **Add IP Address** ובחרו **Allow access from anywhere** (0.0.0.0/0). זה נדרש כדי ש-Render יוכל להתחבר.
4. לחצו **Connect ← Drivers** והעתיקו את כתובת החיבור. היא נראית כך:
   ```
   mongodb+srv://USERNAME:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. החליפו את `<password>` בסיסמה האמיתית, והוסיפו שם לבסיס הנתונים אחרי ה-`/`:
   ```
   mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/kniya?retryWrites=true&w=majority
   ```
   זו הכתובת שתצטרכו בשלבים הבאים — שמרו אותה.

## שלב 2: הרצה מקומית (לבדיקה, לא חובה)

```bash
# בתוך תיקיית הפרויקט:
npm install

# צרו קובץ .env לפי הדוגמה והדביקו בו את כתובת החיבור:
cp .env.example .env
# פתחו את .env בעורך טקסט ועדכנו את MONGODB_URI

npm start
```

פתחו את `http://localhost:3000` בדפדפן. אם רואים את מסך הפתיחה ויצירת משק בית עובדת — הכל מחובר.

## שלב 3: העלאה ל-GitHub

1. צרו ריפוזיטורי חדש ב-GitHub (Private זה בסדר).
2. הדרך הקלה בלי שורת פקודה: בעמוד הריפוזיטורי לחצו **uploading an existing file** וגררו את כל קבצי הפרויקט (כולל תיקיית `public`). **אל תעלו** את `node_modules` או את `.env`.
3. עם git בשורת הפקודה:
   ```bash
   git init
   git add .
   git commit -m "קנייה חכמה"
   git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
   git push -u origin main
   ```

חשוב: קובץ `.env` עם הסיסמה לעולם לא עולה ל-GitHub (ה-`.gitignore` כבר דואג לזה).

## שלב 4: פריסה ב-Render

1. הירשמו ל-Render והתחברו עם חשבון GitHub.
2. לחצו **New ← Web Service** ובחרו את הריפוזיטורי שהעליתם.
3. הגדרות:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
4. תחת **Environment Variables** הוסיפו משתנה:
   - Key: `MONGODB_URI`
   - Value: כתובת החיבור מ-Atlas (מהשלב הראשון)
5. לחצו **Deploy**. אחרי דקה-שתיים תקבלו כתובת כמו `https://kniya-chachama.onrender.com` — זו האפליקציה שלכם, שלחו אותה למשפחה.

הערה על השכבה החינמית של Render: אחרי רבע שעה ללא שימוש השרת "נרדם", והכניסה הראשונה אחר כך לוקחת ~30 שניות להתעורר. לשימוש משפחתי זה בדרך כלל סביר; אם זה מציק, התוכנית בתשלום של Render פותרת זאת.

## שלב 5: התקנה בטלפון (PWA)

האפליקציה מוכנה להתקנה למסך הבית — אייקון משלה, מסך מלא בלי שורת דפדפן:

- **Android (Chrome)**: פתחו את הכתובת ← תפריט ⋮ ← **הוספה למסך הבית** / **התקנת אפליקציה**.
- **iPhone (Safari)**: פתחו את הכתובת ← כפתור שיתוף ← **הוסף למסך הבית**.

## איך השיתוף עובד

הראשון שנכנס בוחר "משק בית חדש" ומקבל **קוד בן 6 תווים** (מופיע גם בלחיצה על אייקון האנשים למעלה). שאר בני המשפחה בוחרים "הצטרפות עם קוד" ומקלידים אותו — פעם אחת בלבד, הטלפון זוכר. מאותו רגע כולם רואים ומעדכנים את אותן רשימות, והמסך מתעדכן אוטומטית כל כמה שניות.

## מבנה הפרויקט

```
super-app/
├── server.js          # שרת Express + כל ה-API + חיבור למונגו
├── package.json
├── .env.example       # תבנית למשתני סביבה
└── public/
    ├── index.html     # האפליקציה כולה (React)
    ├── manifest.json  # הגדרות PWA
    ├── sw.js          # service worker להתקנה
    └── icon-*.png     # אייקונים
```

## פתרון תקלות

- **"חיבור למונגו נכשל"** — בדקו שכתובת ה-MONGODB_URI נכונה (סיסמה, שם משתמש) ושב-Atlas פתחתם Network Access ל-0.0.0.0/0.
- **"שגיאת חיבור — נסו שוב" באפליקציה** — השרת לא זמין; ב-Render בדקו את ה-Logs של השירות.
- **קוד הצטרפות לא נמצא** — הקוד רגיש לשרת: ודאו ששני המכשירים נכנסים לאותה כתובת (אותו deployment).
