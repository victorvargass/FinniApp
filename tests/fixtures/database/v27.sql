PRAGMA foreign_keys = ON;
PRAGMA user_version = 27;

CREATE TABLE periods (
  id INTEGER PRIMARY KEY,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL
);
CREATE TABLE settings (
  id INTEGER PRIMARY KEY,
  current_period_id INTEGER,
  FOREIGN KEY (current_period_id) REFERENCES periods(id)
);
CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE income_categories (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE payment_methods (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  show_on_home INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE expenses (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  period_id INTEGER NOT NULL,
  category_id INTEGER,
  payment_method_id INTEGER,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  FOREIGN KEY (period_id) REFERENCES periods(id),
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id)
);
CREATE TABLE incomes (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  period_id INTEGER NOT NULL,
  income_category_id INTEGER,
  payment_method_id INTEGER,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  FOREIGN KEY (period_id) REFERENCES periods(id),
  FOREIGN KEY (income_category_id) REFERENCES income_categories(id),
  FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id)
);
CREATE TABLE savings_goals (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  current_amount INTEGER NOT NULL,
  show_on_home INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE manual_debts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  direction TEXT NOT NULL,
  current_balance INTEGER NOT NULL,
  show_on_home INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE debt_plans (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  total_amount INTEGER NOT NULL,
  show_on_home INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE recurring_expenses (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  next_due_date TEXT NOT NULL
);

INSERT INTO periods VALUES (1, '2026-09-01', '2026-09-30');
INSERT INTO settings VALUES (1, 1);
INSERT INTO categories VALUES (1, 'Alimentación QA');
INSERT INTO income_categories VALUES (1, 'Ingreso QA');
INSERT INTO payment_methods VALUES (1, 'Cuenta QA', 'debit', 1);
INSERT INTO expenses VALUES (1, 'Compra ficticia', 12500, 1, 1, 1, '2026-09-10', '12:30');
INSERT INTO incomes VALUES (1, 'Ingreso ficticio', 200000, 1, 1, 1, '2026-09-05', '09:15');
INSERT INTO savings_goals VALUES (1, 'Meta ficticia', 45000, 1);
INSERT INTO manual_debts VALUES (1, 'Deuda ficticia', 'payable', 30000, 1);
INSERT INTO debt_plans VALUES (1, 'Cuotas ficticias', 90000, 1);
INSERT INTO recurring_expenses VALUES (1, 'Recurrencia ficticia', 8000, '2026-10-10');
