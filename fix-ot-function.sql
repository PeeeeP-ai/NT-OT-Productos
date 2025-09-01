-- Migration to add TIMESTAMPTZ fields for actual_start_date and actual_end_date in work_orders table
-- This allows storing both date and time information for work order start and end times

-- Add new TIMESTAMPTZ columns
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS actual_start_datetime TIMESTAMPTZ;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS actual_end_datetime TIMESTAMPTZ;

-- Copy existing DATE values to the new TIMESTAMPTZ columns (assuming they represent start/end of day)
-- Only copy if the new columns are empty and old columns have values
UPDATE work_orders
SET
  actual_start_datetime = CASE
    WHEN actual_start_datetime IS NULL AND actual_start_date IS NOT NULL
    THEN actual_start_date::TIMESTAMPTZ
    ELSE actual_start_datetime
  END,
  actual_end_datetime = CASE
    WHEN actual_end_datetime IS NULL AND actual_end_date IS NOT NULL
    THEN actual_end_date::TIMESTAMPTZ
    ELSE actual_end_datetime
  END;

-- Update the get_work_order_details function to return the new datetime fields
-- This function is used by the backend to get detailed work order information

-- Note: The function definition has been updated in the migration file 004_create_work_orders_tables.sql
-- If you need to apply this separately, you can run the updated function definition from that file.

-- Optional: You can drop the old DATE columns after confirming everything works
-- ALTER TABLE work_orders DROP COLUMN IF EXISTS actual_start_date;
-- ALTER TABLE work_orders DROP COLUMN IF EXISTS actual_end_date;

-- But for now, we'll keep them for backward compatibility as mentioned in the migration
