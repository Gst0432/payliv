/*
  # Add digital/physical flags to orders table

  1. New Columns
    - `has_digital` (boolean) - indicates if order contains digital products
    - `has_physical` (boolean) - indicates if order contains physical products
    - `delivered_at` (timestamptz) - when digital products were delivered

  2. Updates
    - Add default values for existing orders
    - Create function to automatically set these flags
*/

-- Add new columns to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'has_digital'
  ) THEN
    ALTER TABLE orders ADD COLUMN has_digital boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'has_physical'
  ) THEN
    ALTER TABLE orders ADD COLUMN has_physical boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'delivered_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN delivered_at timestamptz;
  END IF;
END $$;

-- Function to automatically detect and set product type flags
CREATE OR REPLACE FUNCTION set_order_product_type_flags()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item jsonb;
  product_record record;
  has_digital_items boolean := false;
  has_physical_items boolean := false;
BEGIN
  -- Loop through order items to check product types
  FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
  LOOP
    -- Get product type from products table
    SELECT product_type INTO product_record
    FROM products 
    WHERE id = (item->>'product_id')::uuid;
    
    IF product_record.product_type = 'digital' THEN
      has_digital_items := true;
    ELSIF product_record.product_type = 'physical' THEN
      has_physical_items := true;
    END IF;
  END LOOP;
  
  -- Update the order with detected flags
  NEW.has_digital := has_digital_items;
  NEW.has_physical := has_physical_items;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically set flags on order creation
DROP TRIGGER IF EXISTS trigger_set_order_product_type_flags ON orders;
CREATE TRIGGER trigger_set_order_product_type_flags
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_product_type_flags();

-- Update existing orders to set the flags
UPDATE orders 
SET 
  has_digital = (
    SELECT bool_or(p.product_type = 'digital')
    FROM jsonb_array_elements(items) AS item
    JOIN products p ON p.id = (item->>'product_id')::uuid
  ),
  has_physical = (
    SELECT bool_or(p.product_type = 'physical')
    FROM jsonb_array_elements(items) AS item
    JOIN products p ON p.id = (item->>'product_id')::uuid
  )
WHERE has_digital IS NULL OR has_physical IS NULL;