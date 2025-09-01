// Script to update the generate_work_order_number function
// Run this with: node update-function.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './public_html/api/.env' });

const supabaseUrl = process.env.SUPABASE_REST_URL;
const supabaseKey = process.env.SUPABASE_ANON_PUBLIC;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateFunction() {
  console.log('🔄 Updating generate_work_order_number function...');

  const sql = `
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
  `;

  try {
    const { data, error } = await supabase.rpc('exec', { query: sql });

    if (error) {
      console.error('❌ Error updating function:', error);
      return;
    }

    console.log('✅ Function updated successfully');

    // Test the function
    const { data: testData, error: testError } = await supabase.rpc('exec', {
      query: 'SELECT generate_work_order_number() as next_order_number'
    });

    if (testError) {
      console.error('❌ Error testing function:', testError);
    } else {
      console.log('🧪 Test result:', testData);
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

updateFunction();
