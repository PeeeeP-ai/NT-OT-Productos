-- Fix the generate_work_order_number function to handle existing old format OT numbers
-- This script should be run in Supabase SQL editor or via psql

-- First, let's see what the current function looks like and what OT numbers exist
SELECT order_number FROM work_orders WHERE order_number LIKE 'OT-%' ORDER BY created_at DESC LIMIT 10;

-- Update the function to properly handle both old and new formats
CREATE OR REPLACE FUNCTION generate_work_order_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  current_year INTEGER;
  current_month INTEGER;
  sequence_number INTEGER;
  result_order_number VARCHAR(50);
BEGIN
  current_year := EXTRACT(YEAR FROM NOW());
  current_month := EXTRACT(MONTH FROM NOW());

  -- Get the highest sequence number for the current year-month
  -- Handle both old format (OT-YYYY-XXXXXXX) and new format (OT-YYYY-MM-XXX)
  SELECT COALESCE(MAX(
    CASE
      WHEN order_number LIKE 'OT-' || current_year || '-' || LPAD(current_month::TEXT, 2, '0') || '-%' THEN
        -- New format: extract last 3 digits
        CAST(SUBSTRING(order_number FROM '[0-9]{3}$') AS INTEGER)
      WHEN order_number LIKE 'OT-' || current_year || '-%' THEN
        -- Old format or other formats: extract all digits after the year
        CAST(SUBSTRING(order_number FROM 'OT-' || current_year || '-(.+)') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO sequence_number
  FROM work_orders
  WHERE order_number LIKE 'OT-' || current_year || '-%';

  -- Generate the order number with format OT-YYYY-MM-001
  result_order_number := 'OT-' || current_year || '-' || LPAD(current_month::TEXT, 2, '0') || '-' || LPAD(sequence_number::TEXT, 3, '0');

  RETURN result_order_number;
END;
$$ LANGUAGE plpgsql;

-- Test the function
SELECT generate_work_order_number() as next_order_number;
