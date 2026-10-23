-- Central Perk Cafe -- Feature 4 menu seed data
-- Matches the Week 1 spec's "Full menu -- Feature 4" reference table.
-- Prices are dine-in; the Rs.5 parcel charge is added in Cart (Feature 5), not here.
-- Safe to re-run: clears existing menu rows first.

delete from public.menu;

insert into public.menu (dish_name, price, sub_category, is_veg, toppings, extras) values
-- Beverages
('Cold Coffee', 70, 'Beverages', true, '[]', '[]'),
('Filter Coffee', 25, 'Beverages', true, '[]', '[]'),
('Rose Milk', 45, 'Beverages', true, '[]', '[]'),
('Milo Shake', 60, 'Beverages', true, '[]', '[]'),
('Brownie Shake', 70, 'Beverages', true, '[]', '[]'),
('Peanut Butter Shake', 60, 'Beverages', true, '[]', '[]'),

-- Omelettes & Eggs
('Boiled Egg', 15, 'Omelettes & Eggs', false, '[]', '[]'),
('Bread Omelette', 50, 'Omelettes & Eggs', false, '[]', '[]'),
('Chicken Omelette', 70, 'Omelettes & Eggs', false, '[]', '[{"name": "Extra Cheese", "price": 15}]'),
('Spanish Omelette', 60, 'Omelettes & Eggs', false, '[]', '[]'),

-- Rolls, Momos & Other Savouries
('Chicken Momos', 90, 'Rolls, Momos & Other Savouries', false, '[]', '[]'),
('Veg Momos', 80, 'Rolls, Momos & Other Savouries', true, '[]', '[]'),
('Paneer Roll', 55, 'Rolls, Momos & Other Savouries', true, '[]', '[]'),
('Chicken Roll', 65, 'Rolls, Momos & Other Savouries', false, '[]', '[]'),
('Chicken with Plain Sauces', 60, 'Rolls, Momos & Other Savouries', false, '[]', '[]'),
('Corn Flakes', 40, 'Rolls, Momos & Other Savouries', true, '[]', '[]'),
('Cheese Triangles', 60, 'Rolls, Momos & Other Savouries', true, '[]', '[]'),

-- Sandwiches (Paneer/Chicken and Club Paneer/Chicken are two dishes each, same price)
('Veg Sandwich', 60, 'Sandwiches', true, '[]', '[]'),
('Paneer Sandwich', 70, 'Sandwiches', true, '[]', '[]'),
('Chicken Sandwich', 70, 'Sandwiches', false, '[]', '[]'),
('Club Paneer Sandwich', 100, 'Sandwiches', true, '[]', '[]'),
('Club Chicken Sandwich', 100, 'Sandwiches', false, '[]', '[]'),

-- Fries
('Peri Peri Fries', 70, 'Fries', true, '[]', '[]'),
('French Fries', 60, 'Fries', true, '[]', '[]'),
('Loaded Fries -- Chicken', 120, 'Fries', false, '[]', '[]'),
('Loaded Fries -- Paneer', 120, 'Fries', true, '[]', '[]'),

-- Desserts > Waffles (free toppings, paid Rs.30 ice-cream add-on)
('Red Velvet Waffle', 109, 'Waffles', true,
  '["Milk Chocolate", "Dark Chocolate", "White Chocolate", "Hazelnut", "Cookies & Cream"]',
  '[{"name": "Ice Cream", "price": 30}]'),
('Chocolate Waffle', 109, 'Waffles', true,
  '["Milk Chocolate", "Dark Chocolate", "White Chocolate", "Hazelnut", "Cookies & Cream"]',
  '[{"name": "Ice Cream", "price": 30}]'),
('Vanilla Waffle', 99, 'Waffles', true,
  '["Milk Chocolate", "Dark Chocolate", "White Chocolate", "Hazelnut", "Cookies & Cream"]',
  '[{"name": "Ice Cream", "price": 30}]'),

-- Desserts > Mini Pancakes
('Nutella Mini Pancakes', 80, 'Mini Pancakes', true, '[]', '[]'),
('Red Velvet Mini Pancakes', 80, 'Mini Pancakes', true, '[]', '[]'),

-- Desserts > Brownie
('Brownie with Ice Cream', 110, 'Brownie', true, '[]', '[]');
