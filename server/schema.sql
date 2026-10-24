CREATE DATABASE IF NOT EXISTS hotel_db;
USE hotel_db;

CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id INT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  seats INT NOT NULL DEFAULT 4
);

CREATE TABLE IF NOT EXISTS menu_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description VARCHAR(255) NULL,
  price DECIMAL(10,2) NOT NULL,
  old_price DECIMAL(10,2) NULL,
  -- 'piece' = normal menu item, 'kg' = sold on the Scale page, price is per kg
  sold_by VARCHAR(10) NOT NULL DEFAULT 'piece',
  image VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  available TINYINT(1) NOT NULL DEFAULT 1
);

-- Menu headings: name = heading shown above the items, tag = small label (e.g. HOT OFFERS)
CREATE TABLE IF NOT EXISTS menu_categories (
  name VARCHAR(50) PRIMARY KEY,
  tag VARCHAR(50) NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS waiters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(30),
  active TINYINT(1) NOT NULL DEFAULT 1
);

-- order_type: dine_in (table QR), takeaway (counter), phone (call), online (website)
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_type ENUM('dine_in','takeaway','phone','online') NOT NULL DEFAULT 'dine_in',
  -- Daily number per order type: D-01, T-01, P-01, O-01
  order_no INT NULL,
  table_id INT NULL,
  waiter_id INT NULL,
  customer_name VARCHAR(100),
  customer_phone VARCHAR(30),
  customer_email VARCHAR(120),
  address VARCHAR(255),
  status ENUM('pending','accepted','served','paid','cancelled') NOT NULL DEFAULT 'pending',
  note VARCHAR(255),
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  -- Cash handed over by the customer (counter takeaway); change = paid_amount - total
  paid_amount DECIMAL(10,2) NULL,
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (table_id) REFERENCES restaurant_tables(id),
  FOREIGN KEY (waiter_id) REFERENCES waiters(id)
);

INSERT INTO waiters (name)
SELECT * FROM (SELECT 'Ahmed' AS name UNION ALL SELECT 'Bilal' UNION ALL SELECT 'Usman') AS seed
WHERE NOT EXISTS (SELECT 1 FROM waiters);

-- Running costs for the profit & loss report
CREATE TABLE IF NOT EXISTS expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  expense_date DATE NOT NULL,
  category VARCHAR(50) NOT NULL,
  description VARCHAR(255) NULL,
  amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  menu_item_id INT NOT NULL,
  qty INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  label VARCHAR(150) NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

INSERT IGNORE INTO restaurant_tables (id, name, seats) VALUES
(1,'Table 1',2),(2,'Table 2',2),(3,'Table 3',4),(4,'Table 4',4),(5,'Table 5',4),
(6,'Table 6',4),(7,'Table 7',6),(8,'Table 8',6),(9,'Table 9',8),(10,'Table 10',8);

INSERT INTO menu_items (name, category, price)
SELECT * FROM (
  SELECT 'Chicken Biryani' AS name, 'Main' AS category, 350 AS price UNION ALL
  SELECT 'Chicken Karahi', 'Main', 900 UNION ALL
  SELECT 'Daal Makhni', 'Main', 300 UNION ALL
  SELECT 'Butter Naan', 'Bread', 60 UNION ALL
  SELECT 'Roti', 'Bread', 25 UNION ALL
  SELECT 'Raita', 'Sides', 80 UNION ALL
  SELECT 'Salad', 'Sides', 100 UNION ALL
  SELECT 'Cold Drink', 'Drinks', 120 UNION ALL
  SELECT 'Mint Lemonade', 'Drinks', 180 UNION ALL
  SELECT 'Kheer', 'Dessert', 200
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM menu_items);
