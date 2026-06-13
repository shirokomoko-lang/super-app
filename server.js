/* קנייה חכמה — שרת */
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* ─────────── מודלים ─────────── */
const itemSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    qty: String,
    price: String,
    aisle: String,
    done: Boolean,
  },
  { _id: false }
);

const templateSchema = new mongoose.Schema(
  { id: String, name: String, items: [itemSchema] },
  { _id: false }
);

const householdSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, index: true },
    name: String,
    active: [itemSchema],
    home: [itemSchema],
    templates: [templateSchema],
  },
  { timestamps: true }
);

const Household = mongoose.model("Household", householdSchema);

/* ─────────── עזרים ─────────── */
// בלי אותיות/ספרות שמתבלבלות: I, L, O, 0, 1
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function genCode() {
  let s = "";
  for (let i = 0; i < 6; i++)
    s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}
const newId = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const LISTS = new Set(["active", "home"]);

const findByCode = (code) =>
  Household.findOne({ code: String(code || "").toUpperCase().trim() });

const out = (h) => ({
  code: h.code,
  name: h.name,
  active: h.active,
  home: h.home,
  templates: h.templates,
  updatedAt: h.updatedAt,
});

function cleanItem(b) {
  return {
    id: newId(),
    name: String(b.name || "").trim().slice(0, 120),
    qty: String(b.qty || "").trim().slice(0, 40),
    price: String(b.price || "").trim().slice(0, 20),
    aisle: String(b.aisle || "other").slice(0, 30),
    done: false,
  };
}

const ITEM_FIELDS = ["name", "qty", "price", "aisle", "done"];
function applyFields(item, body) {
  for (const f of ITEM_FIELDS) {
    if (f in body) {
      item[f] =
        f === "done" ? Boolean(body[f]) : String(body[f]).slice(0, 120);
    }
  }
}

/* עוטף ראוטים אסינכרוניים כדי שכל שגיאה תוחזר כ-500 מסודר */
const wrap = (fn) => (req, res) =>
  fn(req, res).catch((e) => {
    console.error(e);
    res.status(500).json({ error: "server" });
  });

/* ─────────── API ─────────── */

// יצירת משק בית חדש
app.post(
  "/api/household",
  wrap(async (req, res) => {
    const name = String((req.body || {}).name || "").trim() || "המשפחה שלי";
    let code;
    for (let tries = 0; tries < 20; tries++) {
      code = genCode();
      if (!(await Household.exists({ code }))) break;
    }
    const h = await Household.create({
      code,
      name: name.slice(0, 60),
      active: [],
      home: [],
      templates: [],
    });
    res.json(out(h));
  })
);

// שליפת משק בית (גם משמש להצטרפות וגם ל-polling)
app.get(
  "/api/household/:code",
  wrap(async (req, res) => {
    const h = await findByCode(req.params.code);
    if (!h) return res.status(404).json({ error: "not_found" });
    res.json(out(h));
  })
);

// הוספת פריט לרשימה (active / home)
app.post(
  "/api/household/:code/:list/items",
  wrap(async (req, res) => {
    const { list } = req.params;
    if (!LISTS.has(list)) return res.status(400).json({ error: "bad_list" });
    const h = await findByCode(req.params.code);
    if (!h) return res.status(404).json({ error: "not_found" });
    const item = cleanItem(req.body || {});
    if (!item.name) return res.status(400).json({ error: "no_name" });
    h[list].unshift(item);
    await h.save();
    res.json(out(h));
  })
);

// עדכון פריט
app.patch(
  "/api/household/:code/:list/items/:itemId",
  wrap(async (req, res) => {
    const { list, itemId } = req.params;
    if (!LISTS.has(list)) return res.status(400).json({ error: "bad_list" });
    const h = await findByCode(req.params.code);
    if (!h) return res.status(404).json({ error: "not_found" });
    const item = h[list].find((i) => i.id === itemId);
    if (!item) return res.status(404).json({ error: "no_item" });
    applyFields(item, req.body || {});
    h.markModified(list);
    await h.save();
    res.json(out(h));
  })
);

// מחיקת פריט
app.delete(
  "/api/household/:code/:list/items/:itemId",
  wrap(async (req, res) => {
    const { list, itemId } = req.params;
    if (!LISTS.has(list)) return res.status(400).json({ error: "bad_list" });
    const h = await findByCode(req.params.code);
    if (!h) return res.status(404).json({ error: "not_found" });
    h[list] = h[list].filter((i) => i.id !== itemId);
    await h.save();
    res.json(out(h));
  })
);

// ניקוי כל מה שכבר בעגלה
app.post(
  "/api/household/:code/active/clear-done",
  wrap(async (req, res) => {
    const h = await findByCode(req.params.code);
    if (!h) return res.status(404).json({ error: "not_found" });
    h.active = h.active.filter((i) => !i.done);
    await h.save();
    res.json(out(h));
  })
);

// הוספה מרובה לרשימה (active / home) — לייבוא ולרשימה הגדולה.
// מונע כפילויות לפי שם מול מה שכבר קיים ברשימה.
app.post(
  "/api/household/:code/:list/bulk",
  wrap(async (req, res) => {
    const { list } = req.params;
    if (!LISTS.has(list)) return res.status(400).json({ error: "bad_list" });
    const h = await findByCode(req.params.code);
    if (!h) return res.status(404).json({ error: "not_found" });

    const incoming = Array.isArray((req.body || {}).items) ? req.body.items : [];
    const existing = new Set(h[list].map((i) => i.name));
    const toAdd = [];
    for (const raw of incoming) {
      const item = cleanItem(raw);
      if (!item.name || existing.has(item.name)) continue;
      existing.add(item.name);
      toAdd.push(item);
    }
    h[list].unshift(...toAdd);
    await h.save();
    res.json({ ...out(h), added: toAdd.length });
  })
);

/* ── רשימות קבועות (תבניות) ── */
app.post(
  "/api/household/:code/templates",
  wrap(async (req, res) => {
    const h = await findByCode(req.params.code);
    if (!h) return res.status(404).json({ error: "not_found" });
    const name = String((req.body || {}).name || "").trim().slice(0, 60);
    if (!name) return res.status(400).json({ error: "no_name" });
    h.templates.push({ id: newId(), name, items: [] });
    await h.save();
    res.json(out(h));
  })
);

app.delete(
  "/api/household/:code/templates/:tid",
  wrap(async (req, res) => {
    const h = await findByCode(req.params.code);
    if (!h) return res.status(404).json({ error: "not_found" });
    h.templates = h.templates.filter((t) => t.id !== req.params.tid);
    await h.save();
    res.json(out(h));
  })
);

app.post(
  "/api/household/:code/templates/:tid/items",
  wrap(async (req, res) => {
    const h = await findByCode(req.params.code);
    if (!h) return res.status(404).json({ error: "not_found" });
    const t = h.templates.find((t) => t.id === req.params.tid);
    if (!t) return res.status(404).json({ error: "no_template" });
    const item = cleanItem(req.body || {});
    if (!item.name) return res.status(400).json({ error: "no_name" });
    t.items.unshift(item);
    h.markModified("templates");
    await h.save();
    res.json(out(h));
  })
);

app.patch(
  "/api/household/:code/templates/:tid/items/:itemId",
  wrap(async (req, res) => {
    const h = await findByCode(req.params.code);
    if (!h) return res.status(404).json({ error: "not_found" });
    const t = h.templates.find((t) => t.id === req.params.tid);
    if (!t) return res.status(404).json({ error: "no_template" });
    const item = t.items.find((i) => i.id === req.params.itemId);
    if (!item) return res.status(404).json({ error: "no_item" });
    applyFields(item, req.body || {});
    h.markModified("templates");
    await h.save();
    res.json(out(h));
  })
);

app.delete(
  "/api/household/:code/templates/:tid/items/:itemId",
  wrap(async (req, res) => {
    const h = await findByCode(req.params.code);
    if (!h) return res.status(404).json({ error: "not_found" });
    const t = h.templates.find((t) => t.id === req.params.tid);
    if (!t) return res.status(404).json({ error: "no_template" });
    t.items = t.items.filter((i) => i.id !== req.params.itemId);
    h.markModified("templates");
    await h.save();
    res.json(out(h));
  })
);

/* ── העברה לרשימה הפעילה (עם מניעת כפילויות לפי שם) ── */
app.post(
  "/api/household/:code/transfer",
  wrap(async (req, res) => {
    const h = await findByCode(req.params.code);
    if (!h) return res.status(404).json({ error: "not_found" });
    const { source, templateId, itemIds = [], mode } = req.body || {};

    let pool;
    if (source === "home") pool = h.home;
    else if (source === "template") {
      const t = h.templates.find((t) => t.id === templateId);
      if (!t) return res.status(404).json({ error: "no_template" });
      pool = t.items;
    } else return res.status(400).json({ error: "bad_source" });

    const chosen = pool.filter((i) => itemIds.includes(i.id));
    const names = new Set(h.active.map((i) => i.name));
    const add = chosen
      .filter((c) => !names.has(c.name))
      .map((c) => ({
        id: newId(),
        name: c.name,
        qty: c.qty,
        price: c.price,
        aisle: c.aisle,
        done: false,
      }));
    h.active.unshift(...add);

    if (mode === "move" && source === "home") {
      h.home = h.home.filter((i) => !itemIds.includes(i.id));
    }

    await h.save();
    res.json({ ...out(h), added: add.length });
  })
);

/* כל נתיב אחר → האפליקציה */
app.get("*", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

/* ─────────── הפעלה ─────────── */
const PORT = process.env.PORT || 3000;
const URI = process.env.MONGODB_URI;

if (!URI) {
  console.error("חסר MONGODB_URI — צרו קובץ .env לפי .env.example");
  process.exit(1);
}

mongoose
  .connect(URI)
  .then(() => {
    app.listen(PORT, () =>
      console.log(`✓ קנייה חכמה רצה על פורט ${PORT}`)
    );
  })
  .catch((err) => {
    console.error("חיבור למונגו נכשל:", err.message);
    process.exit(1);
  });
