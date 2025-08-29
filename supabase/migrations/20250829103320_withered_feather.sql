/*
  # Add customer_user_id to orders table

  1. New Columns
    - `customer_user_id` (uuid, foreign key to auth.users)
      - Links orders to user accounts for digital product access

  2. Security
    - Update RLS policies to allow users to see their own orders
*/

-- Add customer_user_id column to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'customer_user_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN customer_user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_orders_customer_user_id ON orders(customer_user_id);

-- Update RLS policy to allow users to see their own orders
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
CREATE POLICY "Users can view their own orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (
    customer_user_id = auth.uid() OR
    (customer->>'email')::text = auth.email()
  );

-- Function to link existing orders to user accounts when they sign up
CREATE OR REPLACE FUNCTION link_orders_to_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Link any existing orders with this email to the new user
  UPDATE orders 
  SET customer_user_id = NEW.id
  WHERE (customer->>'email')::text = NEW.email
    AND customer_user_id IS NULL;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically link orders when user signs up
DROP TRIGGER IF EXISTS trigger_link_orders_to_new_user ON auth.users;
CREATE TRIGGER trigger_link_orders_to_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION link_orders_to_new_user();