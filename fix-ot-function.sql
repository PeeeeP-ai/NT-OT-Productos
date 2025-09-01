-- Function to generate work order number for current date
CREATE OR REPLACE FUNCTION generate_work_order_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  current_year INTEGER;
  current_month INTEGER;
  sequence_number INTEGER;
  result_order_number VARCHAR(50);
  max_existing INTEGER;
BEGIN
  -- Use current date (this will use the database's timezone setting)
  -- For Santiago timezone, we need to ensure the database is set correctly
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  current_month := EXTRACT(MONTH FROM CURRENT_DATE);

  -- Only look for orders with the NEW format (OT-YYYY-MM-XXX) for this specific month
  -- This ensures we don't get confused by old format orders
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM '[0-9]{3}$') AS INTEGER)), 0)
  INTO max_existing
  FROM work_orders
  WHERE order_number LIKE 'OT-' || current_year || '-' || LPAD(current_month::TEXT, 2, '0') || '-%'
    AND order_number ~ '^OT-[0-9]{4}-[0-9]{2}-[0-9]{3}$'  -- Exact format match
    AND LENGTH(order_number) = 14; -- OT-YYYY-MM-XXX = 14 characters

  -- Increment the sequence (if no orders found, max_existing will be 0, so we start with 1)
  sequence_number := max_existing + 1;

  -- Generate the order number with format OT-YYYY-MM-001
  result_order_number := 'OT-' || current_year || '-' || LPAD(current_month::TEXT, 2, '0') || '-' || LPAD(sequence_number::TEXT, 3, '0');

  RETURN result_order_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate work order number for a specific date
CREATE OR REPLACE FUNCTION generate_work_order_number_for_date(
  p_planned_start_date DATE
)
RETURNS VARCHAR(50) AS $$
DECLARE
  target_year INTEGER;
  target_month INTEGER;
  sequence_number INTEGER;
  result_order_number VARCHAR(50);
  max_existing INTEGER;
BEGIN
  target_year := EXTRACT(YEAR FROM p_planned_start_date);
  target_month := EXTRACT(MONTH FROM p_planned_start_date);

  -- Only look for orders with the NEW format (OT-YYYY-MM-XXX) for this specific month
  -- This ensures we don't get confused by old format orders
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM '[0-9]{3}$') AS INTEGER)), 0)
  INTO max_existing
  FROM work_orders
  WHERE order_number LIKE 'OT-' || target_year || '-' || LPAD(target_month::TEXT, 2, '0') || '-%'
    AND order_number ~ '^OT-[0-9]{4}-[0-9]{2}-[0-9]{3}$'  -- Exact format match
    AND LENGTH(order_number) = 14; -- OT-YYYY-MM-XXX = 14 characters

  -- Increment the sequence (if no orders found, max_existing will be 0, so we start with 1)
  sequence_number := max_existing + 1;

  -- Generate the order number with format OT-YYYY-MM-001
  result_order_number := 'OT-' || target_year || '-' || LPAD(target_month::TEXT, 2, '0') || '-' || LPAD(sequence_number::TEXT, 3, '0');

  RETURN result_order_number;
END;
$$ LANGUAGE plpgsql;
