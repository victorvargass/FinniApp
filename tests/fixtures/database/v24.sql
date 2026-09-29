PRAGMA foreign_keys = ON;
PRAGMA user_version = 24;

CREATE TABLE periods (id INTEGER PRIMARY KEY);
CREATE TABLE categories (id INTEGER PRIMARY KEY);
CREATE TABLE payment_methods (id INTEGER PRIMARY KEY);
CREATE TABLE expenses (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  category_id INTEGER,
  period_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL DEFAULT '12:00'
);
CREATE TABLE contact_relationships (id INTEGER PRIMARY KEY);
CREATE TABLE contacts (id INTEGER PRIMARY KEY);
CREATE TABLE manual_debts (id INTEGER PRIMARY KEY);

INSERT INTO periods VALUES (1);
INSERT INTO expenses (id, name, amount, period_id, date)
VALUES (7, 'Compra compartida ficticia', 120000, 1, '2026-09-24');
INSERT INTO contacts VALUES (3);
INSERT INTO manual_debts VALUES (9);
